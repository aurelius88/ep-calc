# EP Calculator

A module for tera proxy that is able to calculate with talent EPs.

## Commands
Commands are in this form:
``epc <command> <argument1> <argument2>...``

Available commands:
- ``info``: Prints information about your current EP, last gained EP exp, current soft cap and so on...
- ``track``: Let you track information about gained EP exp and EP exp left until [start of soft cap][1] and shows you the next and second next highest EP source you could do.
- ``highest``: Prints the highest source for EP exp that can be done without exceeding the soft cap.
- ``config``: Opens a window for configuration if proxy is running in gui mode.
- ``verbose``: Printing more information when tracking is enabled.
- ``count``: Counts number of the sources you can do without exceeding the soft cap
- ``catch-up-mod <EP>``: Prints you the catch up modifier by a given ``EP``.
- ``soft-cap-mod <daily exp> <soft cap>``: Prints you the soft cap modifier by a given ``daily exp`` value and ``soft cap``.
- ``soft-cap-mod-ep <daily exp> <EP>``: As soft-cap-mod, but uses ``EP`` instead of a ``soft cap``.
- ``level <EP>``: Prints the level at a given ``EP``.
- ``exp <EP> <percent>``: Prints the ep exp at a given ``EP`` and a given ``percent`` value of the ep level.
- ``left-exp <EP start> <percent start> <EP end> <percent end>``: Prints the ep exp that is left before exceeding the soft cap at a given ``EP end``, started with ``EP start`` ep and ``percent start`` ep exp percentage of the current day (before earning ep exp). Ended with ``EP end`` ep and ``percent end`` ep exp percentage (the current ep level percentage). If ``EP end`` is not specified then ``EP end`` is the same as ``EP start``. ``percent start`` is 0 by default and ``percent end`` is the same as ``percent start`` as default only if ``EP start`` and ``EP end`` are the same, otherwise it is 0 as default.
- ``soft-cap <EP>``: Prints the soft cap at a given ``EP``. (Value is just approximated. Don't rely on an exact output. But it should be safe. So, the exact soft-cap is always greater than this output.)
- ``lang <language code>``: Changes languages of the sources to another language by a given ``language code``. (Built in language codes are: EN for English, DE for German, FR for French.)

# Install

1. Create directory in tera ``.../tera proxy/mods/`` and name it e.g. ep-calc
2. Download [module.json][4] of ep-calc to the created folder
3. Start [Caali Tera Proxy][5] to auto install it

# Dependencies

**Note:** This module might only work with [Caali Tera Proxy][5]. Not tested with others.

It depends on [util-lib][3]. You don't need to install it manually (when using [Caali Tera Proxy][5]),
but if you like/need to:
1. Create a directory in tera ``.../tera proxy/mods/`` named "util-lib". Should be exactly the name. Otherwise the module won't detect it.
2. Auto update available? yes, then skip 3. Otherwise continue.
3. Download zip from [util-lib][7] and extract everything (but .gitignore, .eslint.rc, manifest.json) to the just created folder. Skip 4.
4. Download [module.json][6] of util-lib to the just created folder.
5. Start [Caali Tera Proxy][5] (to auto install it)


# ToDo

- **Best way to cap**: Calculates the best sources that can be done without exceeding the [soft cap][1]. Efficiency and effectiveness are balanced.
- **Fastest way to cap**: Calculates the fastest sources that can be done without exceeding the [soft cap][1].
- **Most effective way to cap**: Calculates sources that leads to 0 or near 0 ep exp until [soft cap][1].
- **GUI**: For easier usage and a better overview
- **Extended count**: Make *count* to use with other than the char's EP

[1]: #todo "~89% of the real soft cap"
[2]: #todo "source for ep exp like \"Island of Dawn\""
[3]: https://github.com/aurelius88/util-lib/
[4]: https://raw.githubusercontent.com/aurelius88/ep-calc/master/module.json
[5]: https://github.com/caali-hackerman/tera-proxy
[6]: https://raw.githubusercontent.com/aurelius88/util-lib/master/module.json
[7]: https://github.com/aurelius88/util-lib/archive/master.zip
