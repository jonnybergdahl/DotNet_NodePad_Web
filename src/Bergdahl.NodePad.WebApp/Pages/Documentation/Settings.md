# Settings

Open Settings from the account menu: click the account button at the right end of the top bar and choose "Settings".

- To do lists: create, rename and delete to do lists. Deleting a list also deletes its items.
- MCP server: create or revoke the API key for AI assistants (MCP).
- General: Allowed Hosts, the Pages directory and the Backup directory. These are saved to nodepad.json, which is created the first time you save if it does not exist yet; until then the defaults are used (Pages and Backups next to the app). Leave a field empty to go back to its default. Relative paths are relative to the folder NodePad runs from. A changed Pages directory takes effect after restarting NodePad.
- Home Assistant: the address and access token of Home Assistant, and whether the to do lists are synced with it (see "Syncing with Home Assistant" under To do lists).

The Save button at the bottom saves General and Home Assistant together. To do lists and the MCP key change as soon as you click their buttons. Your password is changed on the Account page (see Signing in).

Some options can only be set by editing nodepad.json (or appsettings.json):

- DataProtectionKeysDirectory: where the sign-in cookie keys are stored (default Keys).
- Uploads:MaxBytes: maximum size of an uploaded image in bytes (default 10 MB).
- Logging:File: the log file folder (default Logs) and file name, rolled daily.
