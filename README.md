# EP Calculator

A module for tera proxy that is able to calculate with talent EPs.

## Features

- **info**: Prints information about your current EP, last gained EP exp, current soft cap and so on...
- **catch-up-mod**: Prints you the catch up modifier by a given ep.
- **soft-cap-mod**: Prints you the soft cap modifier by a given daily exp value and soft cap.
- **count**: Counts number of the sources you can do without exceeding the softcap

# Install

1. Create directory in tera ``.../tera proxy/bin/node_modules/`` and name it e.g. ep-calc
2. download [module.json][4] to the created folder
3. start [Caali Tera Proxy][5] to auto install it

# Dependencies

**Note:** This module might only work with [Caali Tera Proxy][5]. Not tested with others.

It depends on [util-lib][3]. You don't need to install it manually, 
but if you like to you need to name the directory to "util-lib". 
Otherwise the module won't detect it and will download another "util-lib" automatically.

# ToDo

- **Best way to cap**: Calculates the best sources to do without exceeding the [soft cap][1]
- **[Soft Cap][1] by ep**: Calculates the soft cap by a given ep
- **Highest [source][2]**: Calculate the highest [source][2] that can be done without exceeding the [soft cap][1]
- **Tracking EP**: Printing messages when ep gained (can be disabled)
- **Soft cap warning: Warning before soft cap is reached. Also printing in a corresponding color.
- Make *count* to use with other than the char's EP

[1]: # "~89% of the real soft cap"
[2]: # "source for ep exp like "
[3]: https://github.com/aurelius88/util-lib/
[4]: https://github.com/aurelius88/ep-calc/blob/master/module.json
[5]: https://github.com/caali-hackerman/tera-proxy