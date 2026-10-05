-- Starts Backseat Driver's reporting when Neovim loads the plugin. Nothing to configure.
if vim.g.loaded_backseat_driver then return end
vim.g.loaded_backseat_driver = true

if vim.fn.has('nvim-0.9') == 0 then return end

vim.api.nvim_create_autocmd('VimEnter', {
  once = true,
  callback = function()
    if vim.g.backseat_driver_enabled == false then return end
    require('backseat-driver').setup()
  end,
})
if vim.v.vim_did_enter == 1 and vim.g.backseat_driver_enabled ~= false then require('backseat-driver').setup() end
