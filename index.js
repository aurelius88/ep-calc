const Utils = require("./lib/utils");

const SOFT_CAP_MULT = 0.88945;
const VANGUARD_BONUS_MOD = 1.3;

const ENGLISH = "en";
const GERMAN = "de";
const FRENCH = "fr";

const EP_TABLE = new Map([
    ["dungeon439", {exp: 1518.65, expAfterLimit: 1215.0, isQuest: true, limit: 16}],
    ["CorsairsFraywindSkyring", {exp: 1518.0, expAfterLimit: 0, isQuest: true, limit: 16}],
    ["dungeon431", {exp: 1418.0, expAfterLimit: 1134.0, isQuest: true, limit: 16}],
    ["dungeon412", {exp: 1267.7, expAfterLimit: 1012.0, isQuest: true, limit: 16}],
    ["levelUp65_2", {exp: 1000.0, expAfterLimit: 0, isQuest: false, limit: 1}],
    ["islandOfDawn", {exp: 911.6, expAfterLimit: 729.0, isQuest: true, limit: 16}],
    ["echoesOfAranea", {exp: 911.0, expAfterLimit: 0, isQuest: true, limit: 16}],
    ["kumasIronBG", {exp: 843.0, expAfterLimit: 0, isQuest: true, limit: 16}],
    ["guardianAndFlyingVanguard", {exp: 500.0, expAfterLimit: 0, isQuest: true, limit: 16}],
    ["pitOfPetrax", {exp: 454.65, expAfterLimit: 0, isQuest: true, limit: 16}],
    ["celestialArena", {exp: 425.0, expAfterLimit: 0, isQuest: true, limit: 16}],
    ["aceDungeons", {exp: 303.0, expAfterLimit: 0, isQuest: true, limit: 16}],
    ["kill30Quest", {exp: 270.0, expAfterLimit: 0, isQuest: true, limit: 16}],
    ["gather30Quest", {exp: 180.0, expAfterLimit: 0, isQuest: true, limit: 16}],
    ["bam", {exp: 10, expAfterLimit: 10.0, isQuest: false, limit: -1}],
    ["levelUp65_1", {exp: 1518.65, expAfterLimit: 0, isQuest: false, limit: 1}]
]);
const EP_TABLE_LABEL = {};
EP_TABLE_LABEL[GERMAN] = {
    dungeon439: "493er+ Dungeon",
    CorsairsFraywindSkyring: "Korsaren / Canyon / Himmelsring",
    dungeon431: "431er Dungeon",
    dungeon412: "412er Dungeon",
    levelUp65_2: "Level up -> 65 (2. Char)",
    islandOfDawn: "Insel der Dämmerung Niedrig/Mittel/Hoch",
    echoesOfAranea: "Erinnerungen der Raqnanfestung",
    kumasIronBG: "Kumas / Tal des Donners",
    guardianAndFlyingVanguard: "(Fligende) Wächter Mission",
    pitOfPetrax: "Petre-Brutstätte",
    celestialArena: "Thron des Himmels",
    aceDungeons: "Dungeon der Prüfungen",
    kill30Quest: "Töte 30 __ quest",
    gather30Quest: "Sammle 30 __ quest",
    bam: "BAM",
    levelUp65_1: "Level up -> 65 (1. Char)"
};
EP_TABLE_LABEL[ENGLISH] = {
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
    constructor(mod) {
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
        this.catchUpMod = 0;   // catch up modifier
        this.softCapMod = 0;     // soft cap modifier

        mod.hook("S_PLAYER_CHANGE_EP", 1, e => {
            this.level = e.level;
            this.totalEP = e.totalPoints;
            this.totalExp = e.exp;
            this.dailyExp = e.dailyExp;
            this.dailyMaxBonusExp = e.dailyExpMax;
            this.lastDiff = e.expDifference;
            this.levelUp = e.levelUp;
            this.catchUpMod = e.baseRev;
            this.softCapMod = e.tsRev;
        });

        mod.hook("S_CHANGE_EP_EXP_DAILY_LIMIT", 1, e => {
            this.dailyMaxBonusExp = e.limit;
        });
    }

    calcBest() {

    }

    countAllEPSources() {
        let result = {};
        for(let key of EP_TABLE.keys()) {
            result[key] = this.countEPSource(key);
        }
        return result;
    }

    // TODO add modulo and check for chatch up limit. Assuming unlimited catch up mod for now~
    countEPSource(epTableKey) {
        let epObj = EP_TABLE.get(epTableKey);
        let epExp = epObj.exp * this.catchUpMod;
        epExp *= epObj.isQuest ? VANGUARD_BONUS_MOD : 1;
        return epExp != 0 ? Math.max(Math.floor(this.leftEP() / epExp), 0) : 0;
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

    /**
     * The left daily experience untill cap is reached. If soft is true the 89%
     * soft cap is used. Otherwise the 100% soft cap.
     * @param  {Boolean} [soft=false] is 89% soft cap?
     * @return {Integer}              the left experience.
     */
    leftDailyBonusExp(soft = false) {
        let diff =
            (soft ? this.softCap() : this.dailyMaxBonusExp) - this.dailyExp;
        return diff < 0 ? 0 : diff;
    }
}

const ROOT_COMMAND = "epc";

module.exports = function ep_calculator(mod) {
    const utils = new Utils(mod);
    const epCalc = new EPCalc(mod);
    const command = mod.command;
    let language = ENGLISH;

    let commands = {
        $default: showEPStatus,

        count: {
            $default: printEpSourcesCount
        },

        help: {
            long() {
                return "The EP calculator.";
            },
            short() {
                return "The EP calculator.";
            },
            count: {
                long() {
                    return "Prints a list of sources for ep exp and how many times you can do it without exceeding the soft cap.";
                },
                short() {
                    return "Prints a list of sources for ep exp and how many times you can do it without exceeding the soft cap.";
                },
                $default() {
                    printHelpList(this.help.count);
                }
            },
            $default() {
                printHelpList(this.help);
            }
        }
    };

    command.add(ROOT_COMMAND, commands, commands);

    function printHelpList(cmds = commands.help) {
        utils.printMessage(cmds.long());
        utils.printMessage("subcommands:");
        for (let c in cmds) {
            if (!["$default", "short", "long"].includes(c)) {
                utils.printMessage(
                    `<font color="${
                        utils.COLOR_HIGHLIGHT
                    }">${c}</font>  -  ${cmds[c].short()}`
                );
            }
        }
    }

    function printEpSourcesCount() {
        let epCounts = epCalc.countAllEPSources();
        for(let key in epCounts) {
            utils.printMessage(`${EP_TABLE_LABEL[language][key]}: ${epCounts[key]}`);
        }
    }

    function showEPStatus() {
        let messages = [];
        messages.push(`EP STATUS:`);
        messages.push(
            `LVL: <font color="${utils.COLOR_VALUE}">${epCalc.level}</font>${
                epCalc.levelUp ? " (Level UP!)" : ""
            }`
        );
        messages.push(
            `EP: <font color="${utils.COLOR_VALUE}">${
                epCalc.usedEP
            }</font>/<font color="${utils.COLOR_HIGHLIGHT}">${
                epCalc.totalEP
            }</font> (left: <font color="${
                utils.COLOR_VALUE
            }">${epCalc.leftEP()}</font>)`
        );
        messages.push(
            `Last XP gained: <font color="${utils.COLOR_HIGHLIGHT}">${
                epCalc.lastDiff
            }</font> (<font color="${utils.COLOR_VALUE}">${
                epCalc.catchUpMod
            }</font>, TS=<font color="${utils.COLOR_VALUE}">${
                epCalc.softCapMod
            }</font>)`
        );
        messages.push(
            `XP: <font color="${
                utils.COLOR_VALUE
            }">${epCalc.dailyStartExp()}</font> ==( <font color="${
                utils.COLOR_VALUE
            }">${epCalc.softCap()}</font> [<font color="${utils.COLOR_VALUE}">${
                epCalc.dailyMaxBonusExp
            }</font>] - <font color="${utils.COLOR_VALUE}">${
                epCalc.dailyExp
            }</font> = <font color="${
                utils.COLOR_HIGHLIGHT
            }">${epCalc.leftDailyBonusExp(true)}</font> [<font color="${
                utils.COLOR_VALUE
            }">${epCalc.leftDailyBonusExp(false)}</font>] )==> <font color="${
                utils.COLOR_VALUE
            }">${epCalc.totalExp}</font>`
        );
        messages.map(x => {
            utils.printMessage(x);
        });
    }
};
