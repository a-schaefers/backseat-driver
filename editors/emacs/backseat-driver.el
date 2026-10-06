;;; backseat-driver.el --- Tell Backseat Driver where you are in your code  -*- lexical-binding: t; -*-

;; Version: 0.1.0
;; Package-Requires: ((emacs "27.1"))
;; URL: https://github.com/a-schaefers/backseat-driver
;; SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

;;; Commentary:

;; Backseat Driver is a Claude Code plugin that tutors while you code.  This
;; mode tells it where you are: which file has the caret, the line and
;; column, the selection, which files are open and on screen, whether the
;; buffer has unsaved changes, and whether Emacs has the keyboard.
;;
;; It keeps one file in the tutor's data folder, editors/emacs-<pid>.json,
;; written when that changes and every 20 seconds while nothing does, so the
;; tutor knows Emacs is still open.  The file goes away when Emacs exits.
;; Nothing is written until Backseat Driver has made its data folder, and
;; nothing is read back.
;;
;;   (add-to-list 'load-path "/path/to/backseat-driver/editors/emacs")
;;   (require 'backseat-driver)
;;   (backseat-driver-mode 1)

;;; Code:

(require 'json)
(require 'seq)

(defgroup backseat-driver nil
  "Tell Backseat Driver where you are in your code."
  :group 'tools)

(defcustom backseat-driver-home nil
  "The tutor's data folder.  Nil finds it the way the tutor does."
  :type '(choice (const nil) directory))

(defconst backseat-driver--beat 20 "Seconds between writes while nothing changes.")
(defconst backseat-driver--debounce 0.15 "Seconds of quiet before a change is written.")
(defconst backseat-driver--stale (* 24 60 60) "Seconds after which another editor's file is left over.")
(defconst backseat-driver--max-listed 50)

(defvar backseat-driver--beat-timer nil)
(defvar backseat-driver--debounce-timer nil)
(defvar backseat-driver--last nil "The report as last written, without its times.")
(defvar backseat-driver--changed 0)
(defvar backseat-driver--active t)
(defvar backseat-driver--roots (make-hash-table :test #'equal))

(defun backseat-driver--now-ms ()
  (truncate (* 1000 (float-time))))

(defun backseat-driver--home ()
  "The data folder, found the way the tutor finds it."
  (let ((override (getenv "BACKSEAT_DRIVER_HOME"))
        (xdg (getenv "XDG_DATA_HOME"))
        (home (or (getenv "HOME") (getenv "USERPROFILE"))))
    (directory-file-name
     (cond (backseat-driver-home (expand-file-name backseat-driver-home))
           ((and override (not (string-empty-p override))) override)
           ((and xdg (not (string-empty-p xdg))) (concat (file-name-as-directory xdg) "backseat-driver"))
           ((and home (not (string-empty-p home))) (concat (file-name-as-directory home) ".local/share/backseat-driver"))
           (t "")))))

(defun backseat-driver--path ()
  (concat (backseat-driver--home) "/editors/emacs-" (number-to-string (emacs-pid)) ".json"))

(defun backseat-driver--file (buffer)
  "BUFFER's file, its real path, or nil when it visits none or a remote one."
  (let ((name (buffer-file-name buffer)))
    (when (and name (not (file-remote-p name)))
      (file-truename name))))

(defun backseat-driver--root (file)
  "The nearest folder above FILE with a .git, remembered per folder."
  (let ((dir (file-name-directory file)))
    (pcase (gethash dir backseat-driver--roots 'unknown)
      ('unknown
       (let* ((found (locate-dominating-file dir ".git"))
              (root (and found (directory-file-name (file-truename found)))))
         (puthash dir (or root 'none) backseat-driver--roots)
         root))
      ('none nil)
      (root root))))

(defun backseat-driver--report ()
  "What Emacs says about itself, or nil when the selected buffer visits no file."
  (let* ((buffer (window-buffer (selected-window)))
         (file (backseat-driver--file buffer)))
    (when file
      (with-current-buffer buffer
        (let* ((line (line-number-at-pos))
               (column (1+ (current-column)))
               (end-line nil)
               (buffers (seq-take (delq nil (mapcar #'backseat-driver--file (buffer-list))) backseat-driver--max-listed))
               (visible (delete-dups
                         (delq nil (mapcar (lambda (window)
                                             (let ((other (backseat-driver--file (window-buffer window))))
                                               (and other (not (equal other file)) other)))
                                           (window-list nil 'no-minibuf))))))
          (when (use-region-p)
            (let ((start (line-number-at-pos (region-beginning)))
                  (end (line-number-at-pos (region-end))))
              (when (> end start)
                (setq line start end-line end))))
          (delq nil
                (list (and (backseat-driver--root file) (cons 'root (backseat-driver--root file)))
                      (cons 'file file)
                      (cons 'line line)
                      (cons 'column column)
                      (and end-line (cons 'endLine end-line))
                      (cons 'modified (if (buffer-modified-p) t :json-false))
                      (and buffers (cons 'buffers (vconcat buffers)))
                      (and visible (cons 'visible (vconcat visible)))
                      (cons 'active (if backseat-driver--active t :json-false)))))))))

(defun backseat-driver--write (report)
  "Writes REPORT whole: a temporary file, then a rename."
  (let ((home (backseat-driver--home)))
    (when (and (not (string-empty-p home)) (file-exists-p (concat home "/.backseat-driver")))
      (let* ((folder (concat home "/editors"))
             (path (backseat-driver--path))
             (temp (concat folder "/." (file-name-nondirectory path) ".tmp"))
             (body (append `((v . 1) (editor . "emacs") (pid . ,(emacs-pid))
                             (at . ,(backseat-driver--now-ms)) (changed . ,backseat-driver--changed))
                           report))
             (coding-system-for-write 'utf-8-unix))
        (make-directory folder t)
        (with-temp-file temp (insert (json-encode body)))
        (rename-file temp path t)))))

(defun backseat-driver--send (&optional beat)
  "Writes the report when it changed, or on a BEAT."
  (condition-case nil
      (let ((report (backseat-driver--report)))
        (cond (report
               (let ((same (equal report backseat-driver--last)))
                 (unless same
                   (setq backseat-driver--last report
                         backseat-driver--changed (backseat-driver--now-ms)))
                 (when (or beat (not same))
                   (backseat-driver--write report))))
              ;; Not in a file: what was last said stands until the caret is in one again.
              ((and beat backseat-driver--last)
               (backseat-driver--write backseat-driver--last))))
    (error nil)))

(defun backseat-driver--soon (&rest _)
  (when backseat-driver--debounce-timer (cancel-timer backseat-driver--debounce-timer))
  (setq backseat-driver--debounce-timer
        (run-with-idle-timer backseat-driver--debounce nil #'backseat-driver--send)))

(defun backseat-driver--focus-changed ()
  (setq backseat-driver--active (and (frame-focus-state) t))
  (backseat-driver--soon))

(defun backseat-driver--sweep ()
  "Removes files left by editors that did not get to remove theirs."
  (let ((folder (concat (backseat-driver--home) "/editors")))
    (when (file-directory-p folder)
      (dolist (file (directory-files folder t "\\.json\\'"))
        (let ((modified (file-attribute-modification-time (file-attributes file))))
          (when (> (float-time (time-subtract nil modified)) backseat-driver--stale)
            (ignore-errors (delete-file file))))))))

(defun backseat-driver--stop ()
  (when backseat-driver--beat-timer (cancel-timer backseat-driver--beat-timer))
  (when backseat-driver--debounce-timer (cancel-timer backseat-driver--debounce-timer))
  (setq backseat-driver--beat-timer nil backseat-driver--debounce-timer nil backseat-driver--last nil)
  (ignore-errors (delete-file (backseat-driver--path))))

;;;###autoload
(define-minor-mode backseat-driver-mode
  "Tell Backseat Driver where you are in your code."
  :global t
  :lighter " Backseat"
  (if backseat-driver-mode
      (progn
        (backseat-driver--sweep)
        (add-hook 'post-command-hook #'backseat-driver--soon)
        (add-hook 'window-buffer-change-functions #'backseat-driver--soon)
        (add-hook 'after-save-hook #'backseat-driver--soon)
        (add-function :after after-focus-change-function #'backseat-driver--focus-changed)
        (add-hook 'kill-emacs-hook #'backseat-driver--stop)
        (setq backseat-driver--beat-timer
              (run-with-timer backseat-driver--beat backseat-driver--beat #'backseat-driver--send t))
        (backseat-driver--send))
    (remove-hook 'post-command-hook #'backseat-driver--soon)
    (remove-hook 'window-buffer-change-functions #'backseat-driver--soon)
    (remove-hook 'after-save-hook #'backseat-driver--soon)
    (remove-function after-focus-change-function #'backseat-driver--focus-changed)
    (remove-hook 'kill-emacs-hook #'backseat-driver--stop)
    (backseat-driver--stop)))

(provide 'backseat-driver)

;;; backseat-driver.el ends here
