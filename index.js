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
const BAM_SOURCE = "bam";
const CRUCIAL_BAM_COUNT = 12;
const MAX_EP_LEVEL = 443;

const EP = require( "./data/ep" ); // EP[XX] = ep on ep lvl XX
const EP_EXP = require( "./data/ep-exp" ); // EP_EXP[XX] = ep exp on ep lvl XX
const EP_TABLE = require( "./data/ep-sources" );
// enchantment isn't something you can rely on. But for the sake of completeness:
// enchant frostmetal +8 -> 45
// enchant frostmetal +9 -> 135
// enchant stormcry +8 -> 100
// enchant stormcry +9 -> 300

// maps: ep -> soft cap
const SOFT_CAP_TABLE = require( "./data/soft-cap" );

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

    static level( ep ) {
        if ( ep < 0 || ep > 500 ) throw new RangeError( `"EP" should be >= 0 and <= 500.` );
        return binarySearch( EP, ep, ( ep1, ep2 ) => ep1 - ep2 );
    }

    get levelUp() {
        return this._levelUp;
    }

    get expAtCurrentLevel() {
        return BigInt( EP_EXP[this._level]);
    }

    // bigint
    exp() {
        return this._totalExp - BigInt( EP_EXP[this._level]);
    }

    // number
    relativeExp() {
        return EPCalc.relativeExp( this._level, this._totalExp );
    }

    expNeeded() {
        return EPCalc.expNeeded( this._level );
    }

    static expAtLevel( level ) {
        if ( level < 0 || level > MAX_EP_LEVEL ) throw new RangeError( `"level" should be >= 0 and <= ${MAX_EP_LEVEL}` );
        return BigInt( EP_EXP[level]);
    }

    // bigint
    static exp( level, totalExp ) {
        if ( level < 0 || level > MAX_EP_LEVEL ) throw new RangeError( `"level" should be >= 0 and <= ${MAX_EP_LEVEL}` );
        if ( totalExp < BigInt( EP_EXP[level]) || ( level != MAX_EP_LEVEL && totalExp >= BigInt( EP_EXP[level + 1]) ) )
            throw new RangeError( `"totalExp" should be >= ${EP_EXP[level]} and < ${EP_EXP[level + 1]}` );
        return totalExp - BigInt( EP_EXP[level]);
    }

    // bigint
    static expEP( ep, percent ) {
        let level = binarySearch( EP, ep, ( ep1, ep2 ) => ep1 - ep2 );
        if ( level < 0 ) throw new Error( `Illegal EP value: ${ep}` );
        if ( percent < 0 || percent >= 100 ) throw new RangeError( `"percent" should be >= 0 and < 100.` );
        let currentLevelExp = Math.round( ( percent / 100 ) * Number( EPCalc.expNeeded( level ) ) );
        return EPCalc.expAtLevel( level ) + BigInt( currentLevelExp );
    }

    static relativeExp( level, totalExp ) {
        return Number( EPCalc.exp( level, totalExp ) ) / Number( EPCalc.expNeeded( level ) );
    }

    static expNeeded( level ) {
        if ( level < 0 || level > MAX_EP_LEVEL ) throw new RangeError( `"level" should be >= 0 and <= ${MAX_EP_LEVEL}` );
        return level < EP_EXP.length - 1 ? BigInt( EP_EXP[level + 1]) - BigInt( EP_EXP[level]) : BigInt( 0 );
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

    // bigint
    static calcLeftExp( epStart, expPercentStart = 0, epEnd = epStart, expPercentEnd = expPercentStart ) {
        let startExp = EPCalc.expEP( epStart, expPercentStart );
        let endExp = EPCalc.expEP( epEnd, expPercentEnd );
        let softCap = Math.floor( EPCalc.calcSoftCapStart( epEnd ) );
        return BigInt( softCap ) - ( endExp - startExp );
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
            : { source: BAM_SOURCE, count: 0 };
    }

    /**
     * The start value of the soft cap. At how much ep exp the soft cap
     * modifier will decrease.
     * @return {number} the start value of the soft cap.
     */
    get softCapStart() {
        return Math.floor( this._softCap * SOFT_CAP_CHANGE_START );
    }

    // FIXME may lead to wrong values when soft cap is accumulated
    get softCap() {
        return this._softCap != undefined ? this._softCap : this.calcSoftCap();
    }

    calcSoftCap() {
        return EPCalc.calcSoftCap( this._totalEP );
    }

    /**
     * (Approximatly) calculates the soft cap by a given ep value and using a soft cap table.
     * @param  {number} ep the ep value.
     * @return {number}    the soft cap by the ep value.
     */
    static calcSoftCap( ep ) {
        let keys = Array.from( SOFT_CAP_TABLE.keys() );
        let foundKey = binarySearch( keys, ep, ( keyA, keyB ) => keyA - keyB );
        if ( foundKey < 0 ) foundKey = ~foundKey - 1;
        if ( foundKey < 0 ) foundKey = 0;
        return Math.floor( SOFT_CAP_TABLE.get( keys[foundKey]) * EPCalc.calcCatchUpMod( ep ) );
    }

    static calcSoftCapStart( ep ) {
        return EPCalc.calcSoftCap( ep ) * SOFT_CAP_CHANGE_START;
    }

    // bigint
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
     * Returns the (calculated) current catch up modifier.
     * @return {numbner} the current catch up modifier.
     */
    get catchUpMod() {
        return this.calcCatchUpMod();
    }

    /**
     * (Approximatly) calculates your catch up modifier.
     * @return {number} your catch up modifier based on your EP.
     */
    calcCatchUpMod() {
        return EPCalc.calcCatchUpMod( this._totalEP );
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
     * Returns the last catch up modifier.
     * @return {number} the last catch up modifier.
     */
    get lastCatchUpMod() {
        return this._catchUpMod;
    }

    /**
     * Returns the (calculated) current soft cap modiefier.
     * @return {number} the current soft cap.
     */
    get softCapMod() {
        return this.calcSoftCapMod();
    }

    /**
     * (Approximatly) calculates your soft cap modifier.
     * @return {number} your soft cap modifier.
     */
    calcSoftCapMod() {
        return EPCalc.calcSoftCapMod( this._dailyExp, this._softCap );
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

    static calcSoftCapModByEP( dailyExp, ep ) {
        return EPCalc.calcSoftCapMod( dailyExp, SOFT_CAP_TABLE[ep]);
    }

    /**
     * Returns the last soft cap modifier.
     * @return {number} the last soft cap.
     */
    get lastSoftCapMod() {
        return this._softCapMod;
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

    applyBonusModifier( epObj ) {
        return EPCalc.applyBonusModifier( this._totalEP, epObj, this._catchUpMod );
    }

    static applyBonusModifier( ep, epObj, catchUpMod ) {
        if ( catchUpMod == undefined ) catchUpMod = EPCalc.calcCatchUpMod( ep );
        return Math.floor( catchUpMod * ( epObj.isQuest ? VANGUARD_BONUS_MOD : 1 ) * epObj.exp );
    }

    static bonusExp( ep, source ) {
        let epObj = EP_TABLE.get( source );
        if ( !epObj ) return 0;
        let epExp = EPCalc.applyBonusModifier( ep, epObj );
        // epExp += epObj.bams * EPCalc.applyBonusModifier( ep, EP_TABLE.get( BAM_SOURCE ) );
        return epExp;
    }
}

const ROOT_COMMAND = "epc";
const ROOT_COMMAND_ALTS = ["ep-calc"];
const LOCALE_PATH_PART = "./locale/locale-";

module.exports = function ep_calculator( mod ) {
    const UtilLib = mod.require["util-lib"];
    const MessageBuilder = UtilLib["message-builder"];
    const ChatHelper = UtilLib["chat-helper"];

    const utils = new ChatHelper( mod );
    const epCalc = new EPCalc( mod );
    const fileHelper = new UtilLib["file-helper"]();

    const configData = mod.settings;
    const command = mod.command;

    mod.hook( "S_PLAYER_CHANGE_EP", 1, { order: 0 }, e => {
        if ( configData.tracking ) {
            printEPStatus();
        }
    });

    mod.hook( "S_CHANGE_EP_EXP_DAILY_LIMIT", 1, () => {
        if ( configData.tracking ) {
            printEPStatus();
        }
    });

    let language = ( configData && configData.defaultLanguage ) || "en";
    let languages = ( configData && configData.languages ) || ["en"];
    let locales = {};
    for ( let lang in languages ) {
        locales[lang] = fileHelper.loadJson( fileHelper.getFullPath( `${LOCALE_PATH_PART}${lang}.json`, __dirname ) );
    }

    function epStatusStep( msgBuilder, leftExp ) {
        let nextHighest = EPCalc.calcNextHighestEPSource( epCalc.totalEP, leftExp );
        if ( nextHighest && nextHighest.count ) {
            msgBuilder.text( " --> " );
            msgBuilder.coloredValue( nextHighest.count, CRUCIAL_BAM_COUNT, 1 ).color();
            msgBuilder.text(
                `x ${locales[language] ? locales[language][nextHighest.source] : DEFAULT_LOCALE[nextHighest.source]} (`
            );
            if ( configData.verbose ) {
                let epData = EP_TABLE.get( nextHighest.source );
                msgBuilder.text(
                    `${epCalc.applyBonusModifier( epData )} [+ ${epData.bams
                        * epCalc.applyBonusModifier( EP_TABLE.get( BAM_SOURCE ) )} (BAMs)] `
                );
            }
            msgBuilder.text( "+ " );
            // FIXME totalEP might change after first vanguard has been turned in
            leftExp -= Math.round( nextHighest.count * EPCalc.bonusExp( epCalc.totalEP, nextHighest.source ) );
            msgBuilder.coloredValue( leftExp, epCalc.softCapStart );
            msgBuilder.color().text( ")" );
        }
        return leftExp;
    }

    function epStatus() {
        let msg = new MessageBuilder();
        msg.highlight( `+${epCalc.lastDiff} ` );
        msg.color().text( `XP ${epCalc.levelUp ? "(Level UP!) " : " "}` );
        let leftExp = epCalc.leftDailyBonusExp( true );
        let leftExpAfter = leftExp;
        msg.coloredValue( leftExp, epCalc.softCapStart ).color();
        leftExpAfter = epStatusStep( msg, leftExpAfter );
        leftExpAfter = epStatusStep( msg, leftExpAfter );
        if ( configData.verbose ) {
            msg.text( " (" );
            msg.text( "CU mod: " );
            msg.coloredValue( epCalc.catchUpMod, CATCH_UP_MOD_BEFORE, CATCH_UP_MOD_AFTER );
            msg.color().text( ", SC mod: " );
            msg.coloredValue( epCalc.softCapMod, SOFT_CAP_MOD_BEFORE, SOFT_CAP_MOD_AFTER, SOFT_CAP_MOD_BEFORE * 0.9 );
            msg.color().text( ")" );
        }
        if ( leftExp < 0 ) msg.highlight( " Soft Cap exceeded." );
        else if ( leftExp < 30 ) msg.highlight( " Soft Cap reached!" );
        else if ( leftExp < 300 ) msg.highlight( " WARNING: Reaching Soft Cap after few BAMs!" );
        return msg.toHtml();
    }

    function printEPStatus() {
        utils.printMessage( epStatus() );
    }

    let cmdMsg = new MessageBuilder();

    let commands = {
        $default( value ) {
            if ( value == undefined || value == "" ) printHelpList( this.help );
            else {
                cmdMsg.clear();
                cmdMsg.text( 'Unknown command. Type "epc help" for help.' );
                utils.printMessage( cmdMsg.toHtml() );
            }
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
            cmdMsg.clear();
            cmdMsg.coloredValue( epCalc.leftDailyBonusExp( true ), epCalc.softCapStart ).color();
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
            try {
                cmdMsg.value( EPCalc.calcCatchUpMod( parseInt( ep, 10 ) ) );
            } catch ( e ) {
                cmdMsg.text( e );
            }
            utils.printMessage( cmdMsg.toHtml() );
        },
        "soft-cap": function( ep ) {
            if ( !ep ) return printHelpList( this.help["soft-cap"]);
            cmdMsg.clear();
            try {
                let epVal = parseInt( ep, 10 );
                cmdMsg.value( EPCalc.calcSoftCapStart( epVal ) );
                cmdMsg.color().text( " [" );
                cmdMsg.value( EPCalc.calcSoftCap( epVal ) );
                cmdMsg.color().text( "]" );
            } catch ( e ) {
                cmdMsg.text( e );
            }
            utils.printMessage( cmdMsg.toHtml() );
        },
        exp: function( ep, percent = 0 ) {
            if ( !ep ) return printHelpList( this.help["exp"]);
            cmdMsg.clear();
            try {
                cmdMsg.value( EPCalc.expEP( parseInt( ep, 10 ), percent ) );
            } catch ( e ) {
                cmdMsg.text( e );
            }
            utils.printMessage( cmdMsg.toHtml() );
        },
        "left-exp": function(
            epStart,
            percentStart = 0,
            epEnd = epStart,
            percentEnd = epEnd == epStart ? percentStart : 0
        ) {
            if ( !epStart ) return printHelpList( this.help["left-exp"]);
            cmdMsg.clear();
            try {
                cmdMsg.value(
                    EPCalc.calcLeftExp(
                        parseInt( epStart, 10 ),
                        parseFloat( percentStart ),
                        parseInt( epEnd, 10 ),
                        parseFloat( percentEnd )
                    )
                );
            } catch ( e ) {
                cmdMsg.text( e );
            }
            utils.printMessage( cmdMsg.toHtml() );
        },
        level: function( ep ) {
            if ( !ep ) return printHelpList( this.help["level"]);
            cmdMsg.clear();
            try {
                cmdMsg.value( EPCalc.level( parseInt( ep, 10 ) ) );
            } catch ( e ) {
                cmdMsg.text( e );
            }
            utils.printMessage( cmdMsg.toHtml() );
        },
        "soft-cap-mod": function( dailyExp, ep ) {
            if ( !ep || !dailyExp ) return printHelpList( this.help["soft-cap-mod"]);
            cmdMsg.clear();
            cmdMsg.value( EPCalc.calcSoftCapMod( parseInt( dailyExp, 10 ), parseInt( ep, 10 ) ) );
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
            highest: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " highest" );
                    return cmdMsg.toHtml();
                },
                short() {
                    return "Prints the highest source for EP exp that can be done without exceeding the soft cap.";
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
            "soft-cap": {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " soft-cap " );
                    cmdMsg.value( "ep " );
                    cmdMsg.color().text( "\nWhere...\n" );
                    cmdMsg.value( "ep" );
                    cmdMsg.color().text( " is the maximal available EP (also displayed in the talent window)." );
                    return cmdMsg.toHtml();
                },
                short() {
                    cmdMsg.clear();
                    cmdMsg.text( "Returns the soft cap by a given " );
                    cmdMsg.value( "ep" );
                    cmdMsg.color().text( "." );
                    return cmdMsg.toHtml();
                },
                $default() {
                    printHelpList( this.help["soft-cap-mod"]);
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
            exp: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " exp " );
                    cmdMsg.value( "ep " ).text( "percent" );
                    cmdMsg.color().text( "\nWhere...\n" );
                    cmdMsg.value( "ep" );
                    cmdMsg.color().text( " is the maximal available EP (also displayed in the talent window) and\n" );
                    cmdMsg.value( "percent" );
                    cmdMsg
                        .color()
                        .text( ' is the percentage of the ep level. (as displayed in talent window, e.g. "67.3")' );
                    return cmdMsg.toHtml();
                },
                short() {
                    cmdMsg.clear();
                    cmdMsg.text( "Prints the total ep exp at a given " );
                    cmdMsg.value( "EP" );
                    cmdMsg.color().text( " and " );
                    cmdMsg.value( "percent" );
                    cmdMsg.color().text( " value." );
                    return cmdMsg.toHtml();
                },
                $default() {
                    printHelpList( this.help["exp"]);
                }
            },
            "left-exp": {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " left-exp " );
                    cmdMsg
                        .value( "ep-start " )
                        .text( "percent-start " )
                        .text( "ep-end " )
                        .text( "percent-end" );
                    cmdMsg.color().text( "\nWhere...\n" );
                    cmdMsg.value( "ep-start" );
                    cmdMsg.color().text( " is the EP that has been started with.\n" );
                    cmdMsg.value( "percent-start" );
                    cmdMsg
                        .color()
                        .text( " is the percentage of the ep level of the current day (before having earned ep exp).\n" );
                    cmdMsg.value( "ep-end" );
                    cmdMsg.color().text( " is the EP that has been ended with and\n" );
                    cmdMsg.value( "percent-end" );
                    cmdMsg
                        .color()
                        .text( " is the percentage of the ep level at the end (the current ep lvl percentage)." );
                    return cmdMsg.toHtml();
                },
                short() {
                    cmdMsg.clear();
                    cmdMsg.text( "Prints the left ep exp before exceeding the soft cap at a given " );
                    cmdMsg.value( "ep-start" );
                    cmdMsg.color().text( ", " );
                    cmdMsg.value( "percent-start" );
                    cmdMsg.color().text( ", " );
                    cmdMsg.value( "ep-end" );
                    cmdMsg.color().text( " and " );
                    cmdMsg.value( "percent-end" );
                    cmdMsg.color().text( " value." );
                    return cmdMsg.toHtml();
                },
                $default() {
                    printHelpList( this.help["left-exp"]);
                }
            },
            level: {
                long() {
                    cmdMsg.clear();
                    cmdMsg.text( "USAGE: " );
                    cmdMsg.command( ROOT_COMMAND );
                    cmdMsg.color().text( " level " );
                    cmdMsg.value( "ep " );
                    cmdMsg.color().text( "\nWhere...\n" );
                    cmdMsg.value( "ep" );
                    cmdMsg.color().text( " is the maximal available EP (also displayed in the talent window)." );
                    return cmdMsg.toHtml();
                },
                short() {
                    cmdMsg.clear();
                    cmdMsg.text( "Returns the level by a given " );
                    cmdMsg.value( "ep" );
                    cmdMsg.color().text( "." );
                    return cmdMsg.toHtml();
                },
                $default() {
                    printHelpList( this.help["level"]);
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
        messages.push( epStatus() );
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
        builder.color().text( " (" );
        builder.coloredValue( epCalc.exp(), epCalc.expNeeded() );
        builder.color().text( "/" );
        builder.value( epCalc.expNeeded() );
        builder.color().text( " [" );
        builder.coloredValue( Math.round( epCalc.relativeExp() * 10000 ) / 100, 100 );
        builder.color().text( "%]) EP: " );
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
