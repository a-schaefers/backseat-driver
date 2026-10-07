-- Backseat Driver for Neovim: tells the tutor where you are in your code.
--
-- It keeps one file in the tutor's data folder, editors/neovim-<pid>.json,
-- saying which file has the caret, the line and column, the selection, which
-- files are open and on screen, whether the buffer has unsaved changes, and
-- whether Neovim has the keyboard. It writes when that changes, and every
-- 20 seconds while nothing does, so the tutor knows Neovim is still open.
-- The file goes away when Neovim exits. Nothing is written until Backseat
-- Driver has made its data folder, and nothing is ever read back.
--
-- Loaded by plugin/backseat-driver.lua. `require('backseat-driver').setup({ enabled = false })` turns it off.

local M = {}

local uv = vim.uv or vim.loop

local BEAT_MS = 20000
local DEBOUNCE_MS = 150
local STALE_S = 24 * 60 * 60
local MAX_LISTED = 50

local state = {
  enabled = true,
  home = nil,
  path = nil,
  last = nil, -- the report as last written, without its times
  changed = 0,
  active = true,
  beat = nil,
  debounce = nil,
  roots = {},
}

local function now_ms()
  local seconds, micros = uv.gettimeofday()
  return seconds * 1000 + math.floor(micros / 1000)
end

-- The data folder, found the way the tutor finds it.
local function data_home()
  local override = os.getenv('BACKSEAT_DRIVER_HOME')
  if override and override ~= '' then return (override:gsub('/+$', '')) end
  local xdg = os.getenv('XDG_DATA_HOME')
  if xdg and xdg ~= '' then return (xdg:gsub('/+$', '')) .. '/backseat-driver' end
  local home = os.getenv('HOME') or os.getenv('USERPROFILE')
  if not home or home == '' then return nil end
  return (home:gsub('/+$', '')) .. '/.local/share/backseat-driver'
end

local function real(path)
  if not path or path == '' then return nil end
  return uv.fs_realpath(path) or path
end

-- The nearest folder upward with a .git (a folder, or a file in a worktree), remembered per folder once found.
-- A folder with none is looked at again each time: a repository may be made under the editor (2026-10-06).
local function repo_root(file)
  local dir = vim.fs.dirname(file)
  if state.roots[dir] then return state.roots[dir] end
  local found = vim.fs.find('.git', { path = dir, upward = true, limit = 1 })[1]
  local root = found and real(vim.fs.dirname(found)) or nil
  if root then state.roots[dir] = root end
  return root
end

local function file_of(buf)
  if not vim.api.nvim_buf_is_valid(buf) or vim.bo[buf].buftype ~= '' then return nil end
  local name = vim.api.nvim_buf_get_name(buf)
  if name == '' or name:match('^%a[%w+.-]*://') then return nil end
  return real(name)
end

-- What Neovim says about itself, or nil when the current buffer is not a file.
local function report()
  local buf = vim.api.nvim_get_current_buf()
  local file = file_of(buf)
  if not file then return nil end
  local cursor = vim.api.nvim_win_get_cursor(0)
  local line = cursor[1]
  local column = vim.fn.charcol('.')
  local end_line = nil
  local mode = vim.api.nvim_get_mode().mode
  if mode == 'v' or mode == 'V' or mode == '\22' then
    local other = vim.fn.line('v')
    if other ~= line then
      end_line = math.max(other, line)
      line = math.min(other, line)
    end
  end

  local buffers = {}
  for _, other in ipairs(vim.api.nvim_list_bufs()) do
    if #buffers >= MAX_LISTED then break end
    if vim.bo[other].buflisted then
      local path = file_of(other)
      if path then table.insert(buffers, path) end
    end
  end
  local visible = {}
  for _, win in ipairs(vim.api.nvim_tabpage_list_wins(0)) do
    local path = file_of(vim.api.nvim_win_get_buf(win))
    if path and path ~= file and not vim.tbl_contains(visible, path) then table.insert(visible, path) end
  end

  return {
    root = repo_root(file),
    file = file,
    line = line,
    column = column,
    endLine = end_line,
    modified = vim.bo[buf].modified,
    -- An empty Lua table would go out as {}, not [].
    buffers = #buffers > 0 and buffers or nil,
    visible = #visible > 0 and visible or nil,
    active = state.active,
  }
end

-- Writes the file whole: a temporary file, then a rename, so the tutor never reads half of it.
local function write(fields)
  if not state.home or not uv.fs_stat(state.home .. '/.backseat-driver') then return end
  local folder = state.home .. '/editors'
  if not uv.fs_stat(folder) then uv.fs_mkdir(folder, 448) end
  local body = vim.tbl_extend('force', { v = 1, editor = 'neovim', pid = uv.os_getpid(), at = now_ms(), changed = state.changed }, fields)
  local temp = folder .. '/.' .. vim.fs.basename(state.path) .. '.tmp'
  local fd = uv.fs_open(temp, 'w', 420)
  if not fd then return end
  uv.fs_write(fd, vim.json.encode(body))
  uv.fs_close(fd)
  uv.fs_rename(temp, state.path)
end

local function send(is_beat)
  if not state.enabled then return end
  local ok, now = pcall(report)
  if not ok then return end
  if now then
    local same = state.last and vim.deep_equal(now, state.last)
    if same and not is_beat then return end
    if not same then
      state.last = now
      state.changed = now_ms()
    end
  elseif not is_beat or not state.last then
    -- Not in a file: what was last said stands until the caret is in one again.
    return
  end
  write(state.last)
end

local function soon()
  if not state.debounce then return end
  state.debounce:stop()
  state.debounce:start(DEBOUNCE_MS, 0, vim.schedule_wrap(function() send(false) end))
end

-- Files left by editors that did not get to remove theirs.
local function sweep()
  local folder = state.home and (state.home .. '/editors')
  local dir = folder and uv.fs_scandir(folder)
  if not dir then return end
  local cutoff = os.time() - STALE_S
  while true do
    local name = uv.fs_scandir_next(dir)
    if not name then break end
    local stat = uv.fs_stat(folder .. '/' .. name)
    if stat and stat.mtime.sec < cutoff then uv.fs_unlink(folder .. '/' .. name) end
  end
end

local function stop()
  if state.beat then state.beat:stop() end
  if state.debounce then state.debounce:stop() end
  if state.path then uv.fs_unlink(state.path) end
end

function M.setup(options)
  options = options or {}
  if options.enabled == false then
    state.enabled = false
    stop()
    return
  end
  if state.beat then return end
  state.enabled = true
  state.home = options.home or data_home()
  if not state.home then return end
  state.path = state.home .. '/editors/neovim-' .. uv.os_getpid() .. '.json'
  sweep()

  local group = vim.api.nvim_create_augroup('BackseatDriver', { clear = true })
  vim.api.nvim_create_autocmd({ 'BufEnter', 'WinEnter', 'CursorMoved', 'CursorMovedI', 'ModeChanged', 'BufModifiedSet', 'BufWritePost', 'BufDelete' }, {
    group = group,
    callback = soon,
  })
  vim.api.nvim_create_autocmd('FocusGained', { group = group, callback = function() state.active = true; soon() end })
  vim.api.nvim_create_autocmd('FocusLost', { group = group, callback = function() state.active = false; soon() end })
  vim.api.nvim_create_autocmd('VimLeavePre', { group = group, callback = stop })

  state.debounce = uv.new_timer()
  state.beat = uv.new_timer()
  state.beat:start(BEAT_MS, BEAT_MS, vim.schedule_wrap(function() send(true) end))
  vim.schedule(function() send(false) end)
end

-- For :checkhealth-style questions: where the file is, and what was last sent.
function M.status()
  return { path = state.path, enabled = state.enabled, last = state.last }
end

return M
