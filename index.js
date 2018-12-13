const SOFT_CAP_CHANGE_START = 0.88947365;
const SOFT_CAP_CHANGE_END = SOFT_CAP_CHANGE_START + 0.2;
const SOFT_CAP_MOD_BEFORE = 1;
const SOFT_CAP_MOD_AFTER = 0.05;
const VANGUARD_BONUS_MOD = 1.3;
const CATCH_UP_CHANGE_START = 358;
const CATCH_UP_CHANGE_END = 458;
const CATCH_UP_MOD_BEFORE = 3;
const CATCH_UP_MOD_AFTER = 0.1;
const SOFT_CAP_GRADIENT = ( SOFT_CAP_MOD_BEFORE - SOFT_CAP_MOD_AFTER ) / ( SOFT_CAP_CHANGE_START - SOFT_CAP_CHANGE_END );
const CATCH_UP_GRADIENT = ( CATCH_UP_MOD_BEFORE - CATCH_UP_MOD_AFTER ) / ( CATCH_UP_CHANGE_START - CATCH_UP_CHANGE_END );

const EP_TABLE = new Map([
    ["dungeon439", { exp: 1518.65, expAfterLimit: 1215.0, isQuest: true, limit: 16 }],
    ["CorsairsFraywindSkyring", { exp: 1518.0, expAfterLimit: 0, isQuest: true, limit: 16 }],
    ["dungeon431", { exp: 1418.0, expAfterLimit: 1134.0, isQuest: true, limit: 16 }],
    ["dungeon412", { exp: 1267.7, expAfterLimit: 1012.0, isQuest: true, limit: 16 }],
    ["levelUp65_2", { exp: 1000.0, expAfterLimit: 1000.0, isQuest: false, limit: 1 }],
    ["islandOfDawn", { exp: 911.6, expAfterLimit: 729.0, isQuest: true, limit: 16 }],
    ["echoesOfAranea", { exp: 911.0, expAfterLimit: 0, isQuest: true, limit: 16 }],
    ["kumasIronBG", { exp: 843.0, expAfterLimit: 0, isQuest: true, limit: 16 }],
    ["guardianAndFlyingVanguard", { exp: 500.0, expAfterLimit: 0, isQuest: true, limit: 16 }],
    ["pitOfPetrax", { exp: 454.65, expAfterLimit: 0, isQuest: true, limit: 16 }],
    ["celestialArena", { exp: 425.0, expAfterLimit: 0, isQuest: true, limit: 16 }],
    ["aceDungeons", { exp: 303.0, expAfterLimit: 0, isQuest: true, limit: 16 }],
    ["kill30Quest", { exp: 270.0, expAfterLimit: 0, isQuest: true, limit: 16 }],
    ["gather30Quest", { exp: 180.0, expAfterLimit: 0, isQuest: true, limit: 16 }],
    ["bam", { exp: 10.0, expAfterLimit: 10.0, isQuest: false, limit: -1 }],
    ["levelUp65_1", { exp: 1.0, expAfterLimit: 1.0, isQuest: false, limit: 1 }]
]);
// enchantment isn't something you can rely on. But for the sake of completeness:
// enchant frostmetal +8 -> 45
// enchant frostmetal +9 -> 135
// enchant stormcry +8 -> 100
// enchant stormcry +9 -> 300

const DEFAULT_LOCALE = {
    dungeon439: "493+ dungeon",
    CorsairsFraywindSkyring: "Corsairs / Fraywind / Skyring",
    dungeon431: "431 dungeon",
    dungeon412: "412 dungeon",
    levelUp65_2: "Level up -> 65 (2nd char)",
    islandOfDawn: "Island of Dawn Low/Mid/High",
    echoesOfAranea: "Echoes of Aranea",
    kumasIronBG: "Kumas / Iron BG",
    guardianAndFlyingVanguard: "Guardian Vanguard / Flying Vanguard",
    pitOfPetrax: "Pit of Petrax",
    celestialArena: "Celestial Arena",
    aceDungeons: "Ace dungeons",
    kill30Quest: "Kill 30 __ quest",
    gather30Quest: "Gather 30 __ quest",
    bam: "BAM",
    levelUp65_1: "Level up -> 65 (1st char)"
};

class EPCalc {
    constructor( mod ) {
        mod.hook( "S_LOAD_EP_INFO", 1, e => {
            this.level = e.level;
            this.totalEP = e.totalPoints;
            this.totalExp = e.exp;
            this.dailyExp = e.dailyExp;
            this.softCap = e.dailyExpMax;
            this.usedEP = e.usedPoints;
        });

        this.lastDiff = 0;
        this.levelUp = false;
        this.catchUpMod = 0; // catch up modifier
        this.softCapMod = 0; // soft cap modifier

        mod.hook( "S_PLAYER_CHANGE_EP", 1, { order: -100 }, e => {
            this.level = e.level;
            this.totalEP = e.totalPoints;
            this.totalExp = e.exp;
            this.dailyExp = e.dailyExp;
            this.softCap = e.dailyExpMax;
            this.lastDiff = e.expDifference;
            this.levelUp = e.levelUp;
            this.catchUpMod = e.baseRev;
            this.softCapMod = e.tsRev;
        });

        mod.hook( "S_CHANGE_EP_EXP_DAILY_LIMIT", 1, e => {
            this.softCap = e.limit;
        });
    }

    calcBest() {}

    /**
     * Counts how many times you can do each source before reaching the start of soft cap.
     * @return {object} an object with all sources + counts. \{source:count\}
     */
    countAllEPSources() {
        let result = {};
        for ( let key of EP_TABLE.keys() ) {
            result[key] = this.countEPSource( key );
        }
        return result;
    }

    /**
     * Counts how many times a char can do each source before reaching the start of soft cap.
     * @param  {number} ep         the current EP.
     * @param  {number} expPercent the current exp in percent.
     * @return {object}            an object with all sources + counts. \{source:count\}
     */
    static countAllEpSources( ep, expPercentStart, expPercentEnd ) {
        let result = {};
        let leftExp = EPCalc.calcLeftExp( ep, expPercentStart, expPercentEnd );
        for ( let key of EP_TABLE.keys() ) {
            result[key] = EPCalc.countEPSource( ep, leftExp, key );
        }
        return result;
    }

    static calcLeftExp( ep, expPercentStart, expPercentEnd ) {
        return 0; // dummy
    }

    /**
     * Counts how many times you can do a specific source before reaching the start of soft cap.
     * @param  {string} epTableKey the source as string key.
     * @return {number}            the number of sources you can do.
     */
    countEPSource( epTableKey ) {
        return EPCalc.countEPSource( this.totalEP, this.leftDailyBonusExp( true ), epTableKey );
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
        let epObj = EP_TABLE.get( epTableKey );
        let epExp = epObj.exp * ( this.catchUpMod ? this.catchUpMod : EPCalc.calcCatchUpMod( ep ) );
        epExp *= epObj.isQuest ? VANGUARD_BONUS_MOD : 1;
        return epExp > 0 ? Math.max( Math.floor( leftExp / epExp ), 0 ) : 0;
    }

    nextHightestEPSource() {}

    /**
     * The start value of the soft cap. At how much ep exp the soft cap
     * modifier will deacrease.
     * @return {number} the start value of the soft cap.
     */
    get softCapStart() {
        return Math.floor( this.softCap * SOFT_CAP_CHANGE_START );
    }

    /**
     * The EP experience you started with this day.
     * @return {BigInt} the start EP exp of this day.
     */
    startExp() {
        return this.totalExp - BigInt( this.dailyExp );
    }

    /**
     * The unused EP.
     * @return {number} the unused EP.
     */
    leftEP() {
        return this.totalEP - this.usedEP;
    }

    /**
     * (Approximatly) calculates your catch up modifier.
     * @return {number} your catch up modifier based on your EP.
     */
    calcCatchUpMod() {
        return EPCalc.calcCatchUpMod( this.totalEP );
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
        return EPCalc.calcSoftCapMod( this.dailyExp, this.softCap );
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
        let softCapRatio = dailyExp / softCap;
        if ( softCapRatio < SOFT_CAP_CHANGE_START ) return SOFT_CAP_MOD_BEFORE;
        if ( softCapRatio > SOFT_CAP_CHANGE_END ) return SOFT_CAP_MOD_AFTER;
        return ( softCapRatio - SOFT_CAP_CHANGE_START ) * SOFT_CAP_GRADIENT + SOFT_CAP_MOD_BEFORE;
    }

    /**
     * The left daily experience untill cap is reached. If soft is true the 89%
     * soft cap is used. Otherwise the 100% soft cap.
     * @param  {boolean} [soft=false] is 89% soft cap?
     * @return {number}              the left experience.
     */
    leftDailyBonusExp( soft = false ) {
        let diff = ( soft ? this.softCapStart : this.softCap ) - this.dailyExp;
        return diff;
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

    let tracking = false;
    let verbose = false;

    mod.hook( "S_PLAYER_CHANGE_EP", 1, { order: 0 }, e => {
        if ( tracking ) {
            if ( verbose ) {
                printShortEPStatus();
            } else {
                printLongEPStatus();
            }
        }
    });

    let language = ( configData && configData.defaultLanguage ) || "en";
    let languages = ( configData && configData.languages ) || ["en"];
    let locales = {};
    for ( let lang in languages ) {
        locales[lang] = fileHelper.loadJson( fileHelper.getFullPath( `${LOCALE_PATH_PART}${lang}.json`, __dirname ) );
    }

    function printShortEPStatus() {
        let msg = new MessageBuilder();
        msg.color( utils.COLOR_HIGHLIGHT ).text( `+${epCalc.lastDiff}  ` );
        let xpToCap = epCalc.expToCap();
        msg.color( `rgb(40,255,40)` ).text();

        utils.printMessage( msg.toHtml() );
    }

    function printLongEPStatus() {
        showEPStatus();
    }

    let cmdMsg = new MessageBuilder();

    let commands = {
        $default() {
            printHelpList( this.help );
        },
        info: showEPStatus,
        track: function() {
            tracking = !tracking;
            cmdMsg.clear();
            cmdMsg.text( "tracking " );
            if ( tracking ) {
                cmdMsg.color( utils.COLOR_ENABLE ).text( "enabled" );
            } else {
                cmdMsg.color( utils.COLOR_DISABLE ).text( "disabled" );
            }
            utils.printMessage( cmdMsg.toHtml() );
        },
        verbose: function() {
            verbose = !verbose;
            cmdMsg.clear();
            cmdMsg.text( "verbose " );
            if ( verbose ) {
                cmdMsg.color( utils.COLOR_ENABLE ).text( "enabled" );
            } else {
                cmdMsg.color( utils.COLOR_DISABLE ).text( "disabled" );
            }
            utils.printMessage( cmdMsg.toHtml() );
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
            cmdMsg.color( utils.COLOR_VALUE ).text( EPCalc.calcSoftCapMod( parseInt( dailyExp ), parseInt( softCap ) ) );
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
                cmdMsg.color( utils.COLOR_COMMAND ).text( ROOT_COMMAND );
                cmdMsg.color().text( "\nA calculator for talent EPs." );
                cmdMsg.text( "Calculate all things around EP, like soft cap, modifiers, sources of EP, EP exp." );
                cmdMsg.text( "May calculate the best method on how to get to the soft cap (not yet implemented). " );
                cmdMsg.text( `For more help use ${ROOT_COMMAND} help [subcommand]. Subcommands are listed below.` );
                return cmdMsg.toHtml();
            },
            short() {
                return "The EP calculator.";
            },
            info: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.color( utils.COLOR_COMMAND ).text( ROOT_COMMAND );
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
            "catch-up-mod": {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.color( utils.COLOR_COMMAND ).text( ROOT_COMMAND );
                    cmdMsg.color().text( " catch-up-mod " );
                    cmdMsg.color( utils.COLOR_VALUE ).text( "EP" );
                    cmdMsg.color().text( "\nWhere...\n" );
                    cmdMsg.color( utils.COLOR_VALUE ).text( "EP" );
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
                    cmdMsg.color( utils.COLOR_COMMAND ).text( ROOT_COMMAND );
                    cmdMsg.color().text( " soft-cap-mod " );
                    cmdMsg
                        .color( utils.COLOR_VALUE )
                        .text( "daily-exp " )
                        .text( "soft-cap" );
                    cmdMsg.color().text( "\nWhere...\n" );
                    cmdMsg.color( utils.COLOR_VALUE ).text( "daily-exp" );
                    cmdMsg.color().text( " is the exp gained so far and\n" );
                    cmdMsg.color( utils.COLOR_VALUE ).text( "soft-cap" );
                    cmdMsg.color().text( " is the soft cap you want to use for." );
                    return cmdMsg.toHtml();
                },
                short() {
                    cmdMsg.clear();
                    cmdMsg.text( "Returns the soft cap modifier by a given " );
                    cmdMsg.color( utils.COLOR_VALUE ).text( "daily-exp" );
                    cmdMsg.text( "Returns the soft cap modifier by a given " );
                    cmdMsg.color( utils.COLOR_VALUE ).text( "soft-cap" );
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
                    cmdMsg.color( utils.COLOR_COMMAND ).text( ROOT_COMMAND );
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
                    cmdMsg.color( utils.COLOR_COMMAND ).text( ROOT_COMMAND );
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

    function showEPStatus() {
        let builder = new MessageBuilder();
        let messages = [];
        messages.push( `EP STATUS:` );
        builder.color( utils.COLOR_HIGHLIGHT ).text( `+${epCalc.lastDiff}` );
        builder.color().text( ` XP ${epCalc.levelUp ? "(Level UP!)" : ""}` );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.text( "Catch Up modifier: " );
        builder
            .color( utils.COLOR_VALUE )
            .text( epCalc.catchUpMod ? epCalc.catchUpMod : EPCalc.calcCatchUpMod( epCalc.totalEP ) );
        builder.color().text( ", Soft Cap modifier: " );
        builder
            .color( utils.COLOR_VALUE )
            .text( epCalc.softCapMod ? epCalc.softCapMod : EPCalc.calcSoftCapMod( epCalc.dailyExp, epCalc.softCap ) );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.color( utils.COLOR_VALUE ).text( epCalc.startExp() );
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
        builder.value( ` +${epCalc.leftEP()}` );
        messages.push( builder.toHtml() );

        messages.map( x => {
            utils.printMessage( x );
        });
    }
};
