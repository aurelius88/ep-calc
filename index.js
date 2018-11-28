const Utils = require('./lib/utils');

const SOFT_CAP_MULT = 0.88945;

class EPCalc {
    constructor( mod ) {
        mod.hook("S_LOAD_EP_INFO", 1, e => {
            this.level = e.level;
            this.totalEP = e.totalPoints;
            this.totalExp = e.exp;
            this.dailyExp = e.dailyExp;
            this.dailyMaxBonusExp = e.dailyExpMax;
            this.usedEP = e.usedPoints;
        });

        this.lastDiff = 0;
        this.levelUp = false;
        this.baseRev = 0;
        this.tsRev = 0;

        mod.hook("S_PLAYER_CHANGE_EP", 1, e => {
            this.level = e.level;
            this.totalEP = e.totalPoints;
            this.totalExp = e.exp;
            this.dailyExp = e.dailyExp;
            this.dailyMaxBonusExp = e.dailyExpMax;
            this.lastDiff = e.expDifference;
            this.levelUp = e.levelUp;
            this.baseRev = e.baseRev;
            this.tsRev = e.tsRev;
        });

        mod.hook("S_CHANGE_EP_EXP_DAILY_LIMIT", 1, e => {
            this.dailyMaxBonusExp = e.limit;
        });
    }

    softCap() {
        return Math.floor(this.dailyMaxBonusExp * SOFT_CAP_MULT);
    }

    dailyStartExp() {
        return this.totalExp - this.dailyExp;
    }

    leftEP() {
        return this.totalEP - this.usedEP;
    }

    leftDailyBonusExp(soft=false) {
        let diff = (soft ? this.softCap() : this.dailyMaxBonusExp) - this.dailyExp;
        return diff < 0 ? 0 : diff;
    }


}

const ROOT_COMMAND = "epc";

module.exports = function ep_calculator( mod ) {
    const utils = new Utils(mod);
    const epCalc = new EPCalc(mod);
    const command = mod.command;

    let commands = {

        $default: showEPStatus,

        show: {
            $default: showEPStatus
        },

        help: {
            long() { return "The EP calculator."; },
            short() { return "The EP calculator."; },
            show: {
                long() { return "Displays info about EP."; },
                short() { return "Displays info about EP."; },
                $default() { printHelpList(this.help.show); }
            },
            $default() { printHelpList(this.help); }
        }
    };

    command.add( ROOT_COMMAND, commands, commands );

    function printHelpList( cmds = commands.help ) {
        utils.printMessage( cmds.long() );
        utils.printMessage( "subcommands:" );
        for ( let c in cmds ) {
            if ( !["$default","short","long"].includes(c) ) {
                utils.printMessage(
                    `<font color="${utils.COLOR_HIGHLIGHT}">${c}</font>  -  ${cmds[c].short()}`
                );
            }
        }
    }

    function showEPStatus() {
        let messages = [];
        messages.push(`EP STATUS:`);
        messages.push(`LVL: <font color="${utils.COLOR_VALUE}">${epCalc.level}</font>${epCalc.levelUp? " (Level UP!)" : ""}`);
        messages.push(`EP: <font color="${utils.COLOR_VALUE}">${epCalc.usedEP}</font>/<font color="${utils.COLOR_HIGHLIGHT}">${epCalc.totalEP}</font> (left: <font color="${utils.COLOR_VALUE}">${epCalc.leftEP()}</font>)`);
        messages.push(`Last XP gained: <font color="${utils.COLOR_HIGHLIGHT}">${epCalc.lastDiff}</font> (<font color="${utils.COLOR_VALUE}">${epCalc.baseRev}</font>, TS=<font color="${utils.COLOR_VALUE}">${epCalc.tsRev}</font>)`);
        messages.push(`XP: <font color="${utils.COLOR_VALUE}">${epCalc.dailyStartExp()}</font> ==( <font color="${utils.COLOR_VALUE}">${epCalc.softCap()}</font> [<font color="${utils.COLOR_VALUE}">${epCalc.dailyMaxBonusExp}</font>] - <font color="${utils.COLOR_VALUE}">${epCalc.dailyExp}</font> = <font color="${utils.COLOR_HIGHLIGHT}">${epCalc.leftDailyBonusExp(true)}</font> [<font color="${utils.COLOR_VALUE}">${epCalc.leftDailyBonusExp(false)}</font>] )==> <font color="${utils.COLOR_VALUE}">${epCalc.totalExp}</font>`);
        messages.map(x => { utils.printMessage(x); });
    }

}
