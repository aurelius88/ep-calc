const SOFT_CAP_MOD_BEFORE = 1;
const SOFT_CAP_MOD_AFTER = 0.05;
const CATCH_UP_MOD_BEFORE = 3;
const CATCH_UP_MOD_AFTER = 0.1;
const BAM_SOURCE = "bam";
const CRUCIAL_BAM_COUNT = 12;

const EP_TABLE = require( "./data/ep-sources" );
// maps: ep -> soft cap

const DEFAULT_LOCALE = {
    batuDesert: "Batu Desert",
    dungeon439: "439+ dungeon",
    CorsairsFraywindSkyring: "Corsairs / Fraywind / Skyring",
    dungeon431: "431 dungeon",
    dungeon412: "412 dungeon",
    wintera: "Wintera",
    levelUp65_2: "Level up -> 65 (2nd char)",
    islandOfDawn: "Island of Dawn Low/Mid/High",
    echoesOfAranea: "Echoes of Aranea",
    kumasIronBG: "Kumas / Iron BG",
    fishing: "Mission: Fishing",
    guardianAndFlyingVanguard: "Guardian Vanguard / Flying Vanguard",
    pitOfPetrax: "Pit of Petrax",
    celestialArena: "Celestial Arena",
    aceDungeons: "Ace dungeons",
    kill30Quest: "Kill 30/50 __ quest",
    gather30Quest: "Gather 30 __ quest",
    carrot: "Collect 30 Taproots",
    bam: "BAM",
    levelUp65_1: "Level up -> 65 (1st char)"
};

const SettingsUI = require( "tera-mod-ui" ).Settings;

const EPCalc = require( "./ep-calc" );

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
        let nextHighest = EPCalc.calcNextHighestEPSource(
            epCalc.totalEP,
            leftExp,
            epCalc.buffMod,
            epCalc.catchUpMod,
            epCalc.softCapMod
        );
        if ( nextHighest && nextHighest.count ) {
            msgBuilder.text( " --> " );
            msgBuilder.coloredValue( nextHighest.count, CRUCIAL_BAM_COUNT, 1 ).color();
            msgBuilder.text(
                `x ${locales[language] ? locales[language][nextHighest.source] : DEFAULT_LOCALE[nextHighest.source]} (`
            );
            let epData = EP_TABLE.get( nextHighest.source );
            if ( configData.verbose ) {
                msgBuilder.text(
                    `${nextHighest.count * epCalc.applyBonusModifier( epData )} [+ ${epData.bams
                        * epCalc.applyBonusModifier( EP_TABLE.get( BAM_SOURCE ) )} (BAMs)] `
                );
            }
            msgBuilder.text( "+ " );
            // FIXME totalEP might change after first vanguard has been turned in
            let count = nextHighest.count;
            let countOverLimit = count > epData.limit ? count - epData.limit : 0;
            while ( count > 0 ) {
                leftExp -= Math.round(
                    ( countOverLimit > 0 ? countOverLimit : count )
                        * EPCalc.bonusExp(
                            epCalc.totalEP,
                            nextHighest.source,
                            epCalc.buffMod,
                            epCalc.catchUpMod,
                            epCalc.softCapMod,
                            count > epData.limit
                        )
                );
                count = countOverLimit > 0 ? epData.limit : 0;
                countOverLimit = 0;
            }
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
                cmdMsg.value( Math.floor( EPCalc.calcSoftCapStart( epVal ) ) );
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
                cmdMsg.text( e.message );
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
                    EPCalc.calcLeftDailyExp(
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
        builder.text( "Catch-Up-Mod: " );
        if ( epCalc.lastCatchUpMod ) {
            builder.value( round( epCalc.lastCatchUpMod, 5 ) );
            builder.color().text( " (last, exactly) -> " );
        }
        builder.value( epCalc.calcCatchUpMod() );
        builder.color().text( " (current, approximately)" );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.color().text( "Soft-Cap-Mod: " );
        if ( round( epCalc.lastSoftCapMod, 5 ) ) {
            builder.value( epCalc.lastSoftCapMod );
            builder.color().text( " (last, exactly) -> " );
        }
        builder.value( epCalc.calcSoftCapMod() );
        builder.color().text( " (current, approximately)" );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.text( "EP-Boost-Mod: " );
        builder.value( epCalc.buffMod );
        if ( epCalc.buff ) builder.color().text( `(${epCalc.buff.name})` );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.color().text( "Total EP-XP: " );
        builder.value( epCalc.startExp );
        builder.color().text( " (start) --" );
        builder.coloredValue( epCalc.dailyExp, 0, epCalc.softCapStart );
        builder.color().text( "--> " );
        builder.value( epCalc.totalExp );
        builder.color().text( " (end)" );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.coloredValue( epCalc.leftDailyBonusExp( true ), epCalc.softCapStart );
        builder.color().text( "/" );
        builder.value( epCalc.softCapStart );
        builder.color().text( `${epCalc.isSoftCapCalculated() ? "*" : ""} [` );
        builder.value( epCalc.leftDailyBonusExp( false ) );
        builder.color().text( "/" );
        builder.value( epCalc.softCap );
        builder.color().text( `${epCalc.isSoftCapCalculated() ? "*" : ""}]` );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.text( "EP-LVL: " );
        builder.value( epCalc.level );
        builder.color().text( " (" );
        builder.coloredValue( epCalc.exp(), epCalc.expNeeded() );
        builder.color().text( "/" );
        builder.value( epCalc.expNeeded() );
        builder.color().text( " - " );
        builder.coloredValue( Math.round( epCalc.relativeExp() * 10000 ) / 100, 100 );
        builder.color().text( "%) --" );
        builder.coloredValue( epCalc.expNeeded() - epCalc.exp(), 0, epCalc.expNeeded() );
        builder.color().text( "--> " );
        builder.value( epCalc.level + 1 );
        messages.push( builder.toHtml() );
        builder.clear();
        builder.color().text( "EP: " );
        builder.value( epCalc.usedEP );
        builder.color().text( "/" );
        builder.highlight( epCalc.totalEP );
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

    function round( value, precission = 0 ) {
        let dev = 10 ** precission;
        return Math.round( value * dev ) / dev;
    }
};
