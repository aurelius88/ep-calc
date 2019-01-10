const binarySearch = require( "binary-search" );

const SOFT_CAP_CHANGE_START = 0.88947365;
const SOFT_CAP_CHANGE_END = SOFT_CAP_CHANGE_START + 0.2;
const SOFT_CAP_MOD_BEFORE = 1;
const SOFT_CAP_MOD_AFTER = 0.05;
const EP_EXP_BONUS_50 = 1.5;
const EP_EXP_BONUS_100 = 2;
const VANGUARD_BONUS_MOD = 1.3;
const CATCH_UP_CHANGE_START = 358;
const CATCH_UP_CHANGE_END = 458;
const CATCH_UP_MOD_BEFORE = 3;
const CATCH_UP_MOD_AFTER = 0.1;
const SOFT_CAP_GRADIENT = ( SOFT_CAP_MOD_BEFORE - SOFT_CAP_MOD_AFTER ) / ( SOFT_CAP_CHANGE_START - SOFT_CAP_CHANGE_END );
const CATCH_UP_GRADIENT = ( CATCH_UP_MOD_BEFORE - CATCH_UP_MOD_AFTER ) / ( CATCH_UP_CHANGE_START - CATCH_UP_CHANGE_END );

const EP_TABLE = new Map([
    ["batuDesert", { exp: 2000.0, expAfterLimit: 1600.0, isQuest: true, limit: 16, asFiller: false }],
    ["dungeon439", { exp: 1518.65, expAfterLimit: 1215.0, isQuest: true, limit: 16, asFiller: true }],
    ["CorsairsFraywindSkyring", { exp: 1518.65, expAfterLimit: 1215.0, isQuest: true, limit: 16, asFiller: false }],
    ["dungeon431", { exp: 1418.0, expAfterLimit: 1134.0, isQuest: true, limit: 16, asFiller: true }],
    ["dungeon412", { exp: 1267.7, expAfterLimit: 1012.0, isQuest: true, limit: 16, asFiller: true }],
    ["levelUp65_2", { exp: 1000.0, expAfterLimit: 1000.0, isQuest: false, limit: 1, asFiller: false }],
    ["islandOfDawn", { exp: 911.6, expAfterLimit: 729.0, isQuest: true, limit: 16, asFiller: true }],
    ["echoesOfAranea", { exp: 911.0, expAfterLimit: 0, isQuest: true, limit: 16, asFiller: true }],
    ["kumasIronBG", { exp: 843.0, expAfterLimit: 0, isQuest: true, limit: 16, asFiller: false }],
    ["fishing", { exp: 646.67, expAfterLimit: 517.3, isQuest: true, limit: 1, asFiller: true }],
    ["guardianAndFlyingVanguard", { exp: 500.0, expAfterLimit: 400.0, isQuest: true, limit: 16, asFiller: true }],
    ["pitOfPetrax", { exp: 454.65, expAfterLimit: 363, isQuest: true, limit: 16, asFiller: true }],
    ["celestialArena", { exp: 425.0, expAfterLimit: 340, isQuest: true, limit: 16, asFiller: true }],
    ["aceDungeons", { exp: 303.0, expAfterLimit: 242.4, isQuest: true, limit: 16, asFiller: true }],
    ["kill30Quest", { exp: 270.0, expAfterLimit: 216, isQuest: true, limit: 16, asFiller: true }],
    ["gather30Quest", { exp: 180.0, expAfterLimit: 144, isQuest: true, limit: 16, asFiller: true }],
    ["bam", { exp: 10.0, expAfterLimit: 10.0, isQuest: false, limit: -1, asFiller: true }],
    ["levelUp65_1", { exp: 1.0, expAfterLimit: 1.0, isQuest: false, limit: 1, asFiller: false }]
]);
// enchantment isn't something you can rely on. But for the sake of completeness:
// enchant frostmetal +8 -> 45
// enchant frostmetal +9 -> 135
// enchant stormcry +8 -> 100
// enchant stormcry +9 -> 300

const SOFT_CAP_TABLE = new Map([
    [1, 1002],
    [3, 501],
    [6, 802],
    [12, 902],
    [23, 952],
    [25, 989],
    [34, 995],
    [45, 996],
    [54, 998],
    [57, 1494.3],
    [132, 1497.3],
    [133, 1996.6],
    [199, 1998],
    [200, 2497.3],
    [264, 2497.3],
    [265, 2997],
    [324, 2997],
    [325, 3496.3],
    [358, 3496.3],
    [385, 3496.3],
    [386, 3995],
    [442, 3995],
    [443, 4494.2],
    [498, 4494.2],
    [499, 4994.4],
    [500, 0]
]);

const DEFAULT_LOCALE = {
    batuDesert: "Batu Desert",
    dungeon439: "493+ dungeon",
    CorsairsFraywindSkyring: "Corsairs / Fraywind / Skyring",
    dungeon431: "431 dungeon",
    dungeon412: "412 dungeon",
    levelUp65_2: "Level up -> 65 (2nd char)",
    islandOfDawn: "Island of Dawn Low/Mid/High",
    echoesOfAranea: "Echoes of Aranea",
    kumasIronBG: "Kumas / Iron BG",
    fishing: "Mission: Fishing",
    guardianAndFlyingVanguard: "Guardian Vanguard / Flying Vanguard",
    pitOfPetrax: "Pit of Petrax",
    celestialArena: "Celestial Arena",
    aceDungeons: "Ace dungeons",
    kill30Quest: "Kill 30 __ quest",
    gather30Quest: "Gather 30 __ quest",
    bam: "BAM",
    levelUp65_1: "Level up -> 65 (1st char)"
};

const SettingsUI = require( "tera-mod-ui" ).Settings;

class EPCalc {
    constructor( mod ) {
        this.mod = mod;
        this._lastDiff = 0;
        this._levelUp = false;

        mod.hook( "S_LOAD_EP_INFO", 1, e => {
            this._level = e.level;
            this._totalEP = e.totalPoints;
            this._totalExp = e.exp;
            this._dailyExp = e.dailyExp;
            this._softCap = e.dailyExpMax;
            this._usedEP = e.usedPoints;
        });

        mod.hook( "S_PLAYER_CHANGE_EP", 1, { order: -100 }, e => {
            this._level = e.level;
            this._totalEP = e.totalPoints;
            this._totalExp = e.exp;
            this._dailyExp = e.dailyExp;
            this._softCap = e.dailyExpMax;
            this._lastDiff = e.expDifference;
            this._levelUp = e.levelUp;
            this._catchUpMod = e.baseRev;
            this._softCapMod = e.tsRev;
        });

        mod.hook( "S_CHANGE_EP_EXP_DAILY_LIMIT", 1, e => {
            this._softCap = e.limit;
        });
    }

    get level() {
        return this._level;
    }

    get levelUp() {
        return this._levelUp;
    }

    calcBest() {}

    /**
     * Counts how many times you can do each source before reaching the start of soft cap.
     * @return {object} an object with all sources + counts. \{source:count\}
     */
    countAllEPSources() {
        return EPCalc.countAllEPSources( this._totalEP, this.leftDailyBonusExp( true ) );
    }

    /**
     * Counts how many times a char can do each source before reaching the start of soft cap.
     * @param  {number} ep         the current EP.
     * @param  {number} expPercent the current exp in percent.
     * @return {object}            an object with all sources + counts. \{source:count\}
     */
    static countAllEPSources( ep, leftExp ) {
        let result = {};
        for ( let key of EP_TABLE.keys() ) {
            result[key] = EPCalc.countEPSource( ep, leftExp, key );
        }
        return result;
    }

    static calcLeftExp( ep, expPercentStart, expPercentEnd ) {
        return 0; // FIXME dummy
    }

    /**
     * Counts how many times you can do a specific source before reaching the start of soft cap.
     * @param  {string} epTableKey the source as string key.
     * @return {number}            the number of sources you can do.
     */
    countEPSource( epTableKey ) {
        return EPCalc.countEPSource( this._totalEP, this.leftDailyBonusExp( true ), epTableKey );
    }

    /**
     * Counts how many times a char can do a specific source before reaching the
     * start of soft cap.
     * @param  {number} ep         the current total EP.
     * @param  {BigInt} exp        the current experience.
     * @param  {string} epTableKey the source as string key.
     * @return {number}            the number of sources a char can do.
     */
    static countEPSource( ep, leftExp, epTableKey ) {
        let epExp = EPCalc.bonusExp( ep, epTableKey );
        return epExp > 0 ? Math.max( Math.floor( leftExp / epExp ), 0 ) : 0;
    }

    get nextHightestEPSource() {
        return EPCalc.calcNextHighestEPSource( this._totalEP, this.leftDailyBonusExp( true ) );
    }

    static calcNextHighestEPSource( ep, leftExp ) {
        let sourceCounts = EPCalc.countAllEPSources( ep, leftExp );
        let highestSource = null;
        for ( let source in sourceCounts ) {
            if ( sourceCounts[source] < 1 || !EP_TABLE.get( source ).asFiller ) continue;
            if ( !highestSource ) {
                highestSource = source;
                continue;
            }
            let highestExp = EP_TABLE.get( highestSource ).exp;
            let currentExp = EP_TABLE.get( source ).exp;
            if ( currentExp > highestExp ) highestSource = source;
        }
        return highestSource ?
            { source: highestSource, count: sourceCounts[highestSource] }
            : { source: "bam", count: 0 };
    }

    /**
     * The start value of the soft cap. At how much ep exp the soft cap
     * modifier will deacrease.
     * @return {number} the start value of the soft cap.
     */
    get softCapStart() {
        return Math.floor( this._softCap * SOFT_CAP_CHANGE_START );
    }

    get softCap() {
        return this._softCap == undefined ? this.calcSoftCap() : this._softCap;
    }

    calcSoftCap() {
        return EPCalc.calcSoftCap( this._totalEP );
    }

    static calcSoftCap( ep ) {
        let keys = Array.from( SOFT_CAP_TABLE.keys() );
        let foundKey = binarySearch( keys, ep, ( keyA, keyB ) => keyA - keyB );
        if ( foundKey < 0 ) foundKey = ~foundKey;
        return Math.floor( SOFT_CAP_TABLE.get( foundKey ) * EPCalc.calcCatchUpMod( ep ) );
    }

    get totalExp() {
        return this._totalExp;
    }

    /**
     * The EP experience you started with this day.
     * @return {BigInt} the start EP exp of this day.
     */
    get startExp() {
        return this._totalExp - BigInt( this._dailyExp );
    }

    get totalEP() {
        return this._totalEP;
    }

    get usedEP() {
        return this._usedEP;
    }

    /**
     * The unused EP.
     * @return {number} the unused EP.
     */
    get leftEP() {
        return this._totalEP - this._usedEP;
    }

    /**
     * (Approximatly) calculates your catch up modifier.
     * @return {number} your catch up modifier based on your EP.
     */
    calcCatchUpMod() {
        return EPCalc.calcCatchUpMod( this._totalEP );
    }

    get catchUpMod() {
        return this._catchUpMod == undefined ? this.calcCatchUpMod() : this._catchUpMod;
    }

    /**
     * (Approximatly) calculates the catch up modifier.
     * @param  {number} ep the total EP on which to calc the modifier.
     * @return {number}    the catch up modifier based on given EP.
     */
    static calcCatchUpMod( ep ) {
        if ( typeof ep !== "number" ) throw new TypeError( "Argument should be a Number." );
        if ( ep < CATCH_UP_CHANGE_START ) return CATCH_UP_MOD_BEFORE;
        if ( ep > CATCH_UP_CHANGE_END ) return CATCH_UP_MOD_AFTER;
        return ( ep - CATCH_UP_CHANGE_START ) * CATCH_UP_GRADIENT + CATCH_UP_MOD_BEFORE;
    }

    /**
     * (Approximatly) calculates your soft cap modifier.
     * @return {number} your soft cap modifier.
     */
    calcSoftCapMod() {
        return EPCalc.calcSoftCapMod( this._dailyExp, this._softCap );
    }

    get softCapMod() {
        return this._softCapMod == undefined ? this.calcSoftCapMod() : this._softCapMod;
    }

    /**
     * (Approximatly) calculates the soft cap modifier.
     * @param  {number} dailyExp the daily exp gained so far.
     * @param  {number} softCap  the soft cap
     * @return {number}          the soft cap modifier.
     */
    static calcSoftCapMod( dailyExp, softCap ) {
        if ( typeof dailyExp !== "number" || typeof softCap !== "number" )
            throw new TypeError( "Argument should be a Number." );
        if ( softCap == 0 ) return 0;
        let softCapRatio = dailyExp / softCap;
        if ( softCapRatio < SOFT_CAP_CHANGE_START ) return SOFT_CAP_MOD_BEFORE;
        if ( softCapRatio > SOFT_CAP_CHANGE_END ) return SOFT_CAP_MOD_AFTER;
        return ( softCapRatio - SOFT_CAP_CHANGE_START ) * SOFT_CAP_GRADIENT + SOFT_CAP_MOD_BEFORE;
    }

    get lastDiff() {
        return this._lastDiff;
    }

    /**
     * The left daily experience untill cap is reached. If soft is true the 89%
     * soft cap is used. Otherwise the 100% soft cap.
     * @param  {boolean} [soft=false] is 89% soft cap?
     * @return {number}              the left experience.
     */
    leftDailyBonusExp( soft = false ) {
        let diff = ( soft ? this.softCapStart : this._softCap ) - this._dailyExp;
        return diff;
    }

    get dailyExp() {
        return this._dailyExp;
    }

    static bonusExp( ep, source ) {
        let epObj = EP_TABLE.get( source );
        if ( !epObj ) return 0;
        let epExp = epObj.exp * ( this._totalEP === ep ? this._catchUpMod : EPCalc.calcCatchUpMod( ep ) );
        epExp *= epObj.isQuest ? VANGUARD_BONUS_MOD : 1;
        return epExp;
    }
}

const ROOT_COMMAND = "epc";
const ROOT_COMMAND_ALTS = ["ep-calc"];
const LOCALE_PATH_PART = "./locale/locale-";

module.exports = function ep_calculator( mod ) {
    const UtilLib = mod.require["util-lib"];
    const MessageBuilder = UtilLib["message-builder"];

    const utils = new UtilLib["chat-helper"]( mod );
    const epCalc = new EPCalc( mod );
    const fileHelper = new UtilLib["file-helper"]();

    const configData = mod.settings;
    const command = mod.command;

    mod.hook( "S_PLAYER_CHANGE_EP", 1, { order: 0 }, e => {
        if ( configData.tracking ) {
            if ( configData.verbose ) {
                printLongEPStatus();
            } else {
                printShortEPStatus();
            }
        }
    });

    mod.hook( "S_CHANGE_EP_EXP_DAILY_LIMIT", 1, () => {
        if ( configData.tracking ) {
            if ( configData.verbose ) {
                printLongEPStatus();
            } else {
                printShortEPStatus();
            }
        }
    });

    let language = ( configData && configData.defaultLanguage ) || "en";
    let languages = ( configData && configData.languages ) || ["en"];
    let locales = {};
    for ( let lang in languages ) {
        locales[lang] = fileHelper.loadJson( fileHelper.getFullPath( `${LOCALE_PATH_PART}${lang}.json`, __dirname ) );
    }

    function shortEPStatus() {
        let msg = new MessageBuilder();
        msg.color( utils.COLOR_HIGHLIGHT ).text( `+${epCalc.lastDiff} ` );
        msg.color().text( `XP ${epCalc.levelUp ? "(Level UP!) " : " "}` );
        msg.coloredValue( epCalc.leftDailyBonusExp( true ), epCalc.softCapStart );
        let nextHighest = epCalc.nextHightestEPSource;
        let leftExp = epCalc.leftDailyBonusExp( true );
        if ( nextHighest && nextHighest.count ) {
            msg.color().text( " --> " );
            msg.text(
                `${nextHighest.count}x ${
                    locales[language] ? locales[language][nextHighest.source] : DEFAULT_LOCALE[nextHighest.source]
                } (`
            );
            leftExp -= Math.floor( nextHighest.count * EPCalc.bonusExp( epCalc.totalEP, nextHighest.source ) );
            msg.coloredValue( leftExp, epCalc.softCapStart );
            msg.color().text( ")" );
        }
        let secondNextHighest = EPCalc.calcNextHighestEPSource( epCalc.totalEP, leftExp );
        if ( secondNextHighest && secondNextHighest.count ) {
            msg.text(
                ` + ${secondNextHighest.count}x ${
                    locales[language] ?
                        locales[language][secondNextHighest.source]
                        : DEFAULT_LOCALE[secondNextHighest.source]
                } (`
            );
            // FIXME totalEP might change after first vanguard has been turned in
            leftExp -= Math.floor( secondNextHighest.count * EPCalc.bonusExp( epCalc.totalEP, secondNextHighest.source ) );
            msg.coloredValue( leftExp, epCalc.softCapStart );
            msg.color().text( ")" );
        }
        return msg.toHtml();
    }

    function printShortEPStatus() {
        utils.printMessage( shortEPStatus() );
    }

    function printLongEPStatus() {
        showEPStatus();
    }

    let cmdMsg = new MessageBuilder();

    let commands = {
        $default() {
            printHelpList( this.help );
        },
        config: function() {
            if ( ui ) {
                ui.show();
            }
        },
        info: showEPStatus,
        track: function() {
            configData.tracking = !configData.tracking;
            cmdMsg.clear();
            cmdMsg.text( "tracking " );
            appendBool( cmdMsg, configData.tracking );
            utils.printMessage( cmdMsg.toHtml() );
        },
        verbose: function() {
            configData.verbose = !configData.verbose;
            cmdMsg.clear();
            cmdMsg.text( "verbose " );
            appendBool( cmdMsg, configData.verbose );
            utils.printMessage( cmdMsg.toHtml() );
        },
        highest: function() {
            let nextHighest = epCalc.nextHightestEPSource;
            utils.printMessage(
                `${nextHighest.count}x ${
                    locales[language] ? locales[language][nextHighest.source] : DEFAULT_LOCALE[nextHighest.source]
                }`
            );
        },
        count: printEpSourcesCount,
        "catch-up-mod": function( ep ) {
            if ( !ep ) return printHelpList( this.help["catch-up-mod"]);
            cmdMsg.clear();
            cmdMsg.color( utils.COLOR_VALUE ).text( EPCalc.calcCatchUpMod( parseInt( ep ) ) );
            utils.printMessage( cmdMsg.toHtml() );
        },
        "soft-cap-mod": function( dailyExp, softCap ) {
            if ( !softCap || !dailyExp ) return printHelpList( this.help["soft-cap-mod"]);
            cmdMsg.clear();
            cmdMsg.value( EPCalc.calcSoftCapMod( parseInt( dailyExp ), parseInt( softCap ) ) );
            utils.printMessage( cmdMsg.toHtml() );
        },
        lang: function( lang ) {
            if ( !arguments.length ) return printLanguages();
            if ( languages[lang]) {
                utils.printMessage( `Changed language to ${languages[lang]}` );
                language = lang;
            }
        },
        help: {
            long() {
                cmdMsg.clear();
                cmdMsg.text( "USAGE: " );
                cmdMsg.command( ROOT_COMMAND );
                cmdMsg.color().text( "\nA calculator for talent EPs. " );
                cmdMsg.text( "Calculate all things around EP, like soft cap, modifiers, sources of EP, EP exp. " );
                cmdMsg.text( "May calculate the best method on how to get to the soft cap (not yet implemented). " );
                cmdMsg.text( `For more help use "${ROOT_COMMAND} help [subcommand]". Subcommands are listed below.` );
                cmdMsg.text( "\nVerbose " );
                appendBool( cmdMsg, configData.verbose );
                cmdMsg.text( "\nTracking " );
                appendBool( cmdMsg, configData.tracking );
                return cmdMsg.toHtml();
            },
            short() {
                return "The EP calculator.";
            },
            config: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " config" );
                    return cmdMsg.toHtml();
                },
                short() {
                    return "Opens a window for configuration if proxy is running in gui mode.";
                },
                $default() {
                    printHelpList( this.help.config );
                }
            },
            info: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " info" );
                    return cmdMsg.toHtml();
                },
                short() {
                    return "Prints information of the current ep status.";
                },
                $default() {
                    printHelpList( this.help.info );
                }
            },
            track: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " track" );
                    return cmdMsg.toHtml();
                },
                short() {
                    return "Tracks information about gained EP exp and EP exp left until start of soft cap.";
                },
                $default() {
                    printHelpList( this.help.track );
                }
            },
            verbose: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " verbose" );
                    return cmdMsg.toHtml();
                },
                short() {
                    return "Printing more detailed information when tracking is enabled.";
                },
                $default() {
                    printHelpList( this.help.verbose );
                }
            },
            "catch-up-mod": {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " catch-up-mod " );
                    cmdMsg.value( "EP" );
                    cmdMsg.color().text( "\nWhere...\n" );
                    cmdMsg.value( "EP" );
                    cmdMsg.color().text( " is the EP you want to calculate the catch up modifier from." );
                    return cmdMsg.toHtml();
                },
                short() {
                    return "Returns the catch up modifier by a given EP value.";
                },
                $default() {
                    printHelpList( this.help["catch-up-mod"]);
                }
            },
            "soft-cap-mod": {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " soft-cap-mod " );
                    cmdMsg.value( "daily-exp " ).text( "soft-cap" );
                    cmdMsg.color().text( "\nWhere...\n" );
                    cmdMsg.value( "daily-exp" );
                    cmdMsg.color().text( " is the exp gained so far and\n" );
                    cmdMsg.value( "soft-cap" );
                    cmdMsg.color().text( " is the soft cap you want to use for." );
                    return cmdMsg.toHtml();
                },
                short() {
                    cmdMsg.clear();
                    cmdMsg.text( "Returns the soft cap modifier by a given " );
                    cmdMsg.value( "daily-exp" );
                    cmdMsg.color().text( " and " );
                    cmdMsg.value( "soft-cap" );
                    cmdMsg.color().text( "." );
                    return cmdMsg.toHtml();
                },
                $default() {
                    printHelpList( this.help["soft-cap-mod"]);
                }
            },
            count: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " count" );
                    return cmdMsg.toHtml();
                },
                short() {
                    return (
                        "Prints a list of sources for EP exp and "
                        + "how many times you can do each without exceeding the soft cap."
                    );
                },
                $default() {
                    printHelpList( this.help.count );
                }
            },
            lang: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " lang [language-code]" );
                    return cmdMsg.toHtml();
                },
                short() {
                    return "Changes the current language.";
                },
                $default() {
                    printHelpList( this.help.lang );
                }
            },
            $default() {
                printHelpList( this.help );
            }
        }
    };

    command.add( ROOT_COMMAND, commands, commands );
    for ( let cmd of ROOT_COMMAND_ALTS ) {
        command.add( cmd, commands, commands );
    }

    function printHelpList( cmds = commands.help ) {
        utils.printMessage( cmds.long() );
        let keys = Object.keys( cmds );
        let ignoredKeys = ["$default", "short", "long"];
        if ( keys.length <= ignoredKeys.length ) return;
        utils.printMessage( "subcommands:" );
        for ( let c of keys ) {
            if ( !ignoredKeys.includes( c ) ) {
                utils.printMessage( `<font color="${utils.COLOR_HIGHLIGHT}">${c}</font>  -  ${cmds[c].short()}` );
            }
        }
    }

    function printEpSourcesCount() {
        let epCounts = epCalc.countAllEPSources();
        let leftExp = epCalc.leftDailyBonusExp( true );
        if ( leftExp < 0 ) {
            return utils.printMessage( "Soft Cap already exceeded!" );
        }
        let count = 0;
        for ( let key in epCounts ) {
            if ( epCounts[key]) {
                utils.printMessage(
                    `${locales[language] ? locales[language][key] : DEFAULT_LOCALE[key]}: ${epCounts[key]}`
                );
                count++;
            }
        }
        if ( !count ) utils.printMessage( "Soft Cap reached!" );
    }

    function printLanguages() {
        utils.printMessage( "Available language codes:" );
        for ( let lang in languages ) {
            utils.printMessage( `${lang}: ${languages[lang]}` );
        }
    }

    function appendBool( msgBuilder, value ) {
        if ( value ) {
            msgBuilder.color( utils.COLOR_ENABLE ).text( "enabled" );
        } else {
            msgBuilder.color( utils.COLOR_DISABLE ).text( "disabled" );
        }
        return msgBuilder.color();
    }

    function showEPStatus() {
        let builder = new MessageBuilder();
        let messages = [];
        messages.push( `EP STATUS:` );
        messages.push( shortEPStatus() );
        builder.clear();
        builder.text( "Catch Up modifier: " );
        builder.color( utils.COLOR_VALUE ).text( epCalc.catchUpMod );
        builder.color().text( ", Soft Cap modifier: " );
        builder.color( utils.COLOR_VALUE ).text( epCalc.softCapMod );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.color( utils.COLOR_VALUE ).text( epCalc.startExp );
        builder.color().text( " --" );
        builder.coloredValue( epCalc.dailyExp, 0, epCalc.softCapStart );
        builder.color().text( "--> " );
        builder.color( utils.COLOR_VALUE ).text( epCalc.totalExp );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.coloredValue( epCalc.leftDailyBonusExp( true ), epCalc.softCapStart );
        builder.color().text( "/" );
        builder.value( epCalc.softCapStart );
        builder.color().text( " [" );
        builder.value( epCalc.leftDailyBonusExp( false ) );
        builder.color().text( "/" );
        builder.value( epCalc.softCap );
        builder.color().text( "]" );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.text( "EP-LVL: " );
        builder.value( epCalc.level );
        builder.color().text( "  EP: " );
        builder.value( epCalc.usedEP );
        builder.color().text( "/" );
        builder.color( utils.COLOR_HIGHLIGHT ).text( epCalc.totalEP );
        builder.value( ` +${epCalc.leftEP}` );
        messages.push( builder.toHtml() );

        messages.map( x => {
            utils.printMessage( x );
        });
    }
    // Settings UI
    let ui = null;
    if ( global.TeraProxy.GUIMode ) {
        let structure = require( "./settings_structure" );
        ui = new SettingsUI( mod, structure, mod.settings, { height: 232 });
        ui.on( "update", settings => {
            mod.settings = settings;
        });

        this.destructor = () => {
            if ( ui ) {
                ui.close();
                ui = null;
            }
        };
    }
};
