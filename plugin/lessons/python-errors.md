---
title: Errors in Python, on purpose
language: python
level: junior
skills: error-handling, exceptions, input-validation, context-managers
summary: Catch only what you can handle, fail loudly on the rest, and clean up either way.
---
Most Python bugs that reach users are errors handled badly: swallowed, caught too wide, or raised with nothing to go on. This path works through your own code, one habit at a time. Every step ends with something to find or change in a project of yours. The tutor watches, asks, and checks. It does not write it for you.

## Find every bare except
A bare `except:` or `except Exception:` catches everything, including the bugs you need to see, and `KeyboardInterrupt` with the bare form. Read what each one is really protecting against.

Try it: search your project for `except:` and `except Exception`. For each one, say out loud which error it is there for. Narrow it to that error, or delete the handler and let the error through. If none turn up, find the place where a call can fail and nothing handles it, and decide whether it should.

Done when: you can say, for each handler you kept, which error it catches and why that error is expected there.

## Raise errors that say what went wrong
`raise ValueError` with no message, or a message like "bad input", makes the next person guess. A good error names what was wrong and with what value.

Try it: pick a function of yours that takes input from outside (a file, an argument, a request). Make it reject bad input early with an error that names the value and what was expected. Choose between `ValueError`, `TypeError`, and an exception class of your own, and be ready to say why.

Done when: the tutor has read the check and the message, and you can say why you picked that exception type.

## Don't lose the original error
Catching one error and raising another hides where the trouble started unless you chain them. `raise NewError(...) from err` keeps the cause in the traceback.

Try it: find a place where your code catches an error and raises a different one, or returns a default. Decide whether the cause should stay visible, and change it if so. If you have no such place, find a call to a library that can fail and decide what your code should say when it does.

Done when: you can explain what a reader of the traceback sees before and after your change.

## Clean up with `with`
A file, a lock or a connection opened and not closed on the error path leaks. `with` closes it whichever way the block ends. `try`/`finally` does the same where there is no context manager.

Try it: find every `open(` in your project that is not in a `with`. Fix the ones that can leak. If something of yours needs cleaning up and has no context manager, decide between `try`/`finally` and writing one with `contextlib.contextmanager`.

Done when: every resource you open is closed on the error path too, and you can show the tutor where.

## Decide where errors are handled
Handling an error everywhere it can happen buries the code in `try` blocks. Handling it nowhere crashes on the first surprise. Most programs need it in a few places: at the edges, where there is someone to tell.

Try it: draw the path a request or a command takes through your program, and mark where an error would surface to the person using it. Move handling there, and let the middle let errors through.

Done when: you can name the places your program handles errors, and say why each one is the right place.
