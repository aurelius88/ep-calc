const binarySearch = require( "binary-search" );
const util = require( "util" );

const SOFT_CAP_CHANGE_START = 0.88947365;
const SOFT_CAP_CHANGE_END = SOFT_CAP_CHANGE_START + 0.2;
const SOFT_CAP_MOD_BEFORE = 1;
const SOFT_CAP_MOD_AFTER = 0.05;
const VANGUARD_BONUS_MOD = 1.3;
const CATCH_UP_CHANGE_START = 398;
const CATCH_UP_CHANGE_END = 497;
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
// maps: ep -> soft cap
const SOFT_CAP_TABLE = require( "./data/soft-cap" );
const EP_BUFFS = require( "./data/ep-buffs" );

class EPCalc {
    constructor( mod ) {
        this.mod = mod;
        this._lastDiff = 0;
        this._levelUp = false;
        this._buff = null;
        this._dailyQuestLimit = 16;

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

        mod.hook( "S_ABNORMALITY_BEGIN", 3, this.updateBuffMod.bind( this, "S_ABNORMALITY_BEGIN" ) );
        mod.hook( "S_ABNORMALITY_REFRESH", 1, this.updateBuffMod.bind( this, "S_ABNORMALITY_REFRESH" ) );
        mod.hook( "S_ABNORMALITY_END", 1, this.resetBuffMod.bind( this ) );
        mod.hook( "S_RETURN_TO_LOBBY", 1, this.resetBuffMod.bind( this ) );
    }

    resetBuffMod( event ) {
        if ( !event.id || ( this._buff && this._buff.id == event.id ) ) this._buff = null;
    }

    updateBuffMod( type, event ) {
        if ( !this.mod.game.me.is( event.target ) ) return;
        let buff = EP_BUFFS[event.id];
        if ( buff != undefined ) {
            this._buff = buff;
        }
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

    dailyQuestLimit() {
        return this._dailyQuestLimit ? this._dailyQuestLimit : 16;
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
        return EPCalc.countAllEPSources(
            this._totalEP,
            this.leftDailyBonusExp( true ),
            this.buffMod,
            this.catchUpMod,
            this.softCapMod,
            this.dailyQuestLimit
        );
    }

    /**
     * Counts how many times a char can do each source before reaching the start of soft cap.
     * @param  {number} ep         the current EP.
     * @param  {number} leftExp    the ep exp that is left before reaching the soft cap.
     * @param  {number} catchUpMod the modifier of the ep catch-up-system.
     * @param  {number} buffMod    the modifier of the ep buffs.
     * @return {object}            an object with all sources + counts. \{source:count\}
     */
    static countAllEPSources( ep, leftExp, buffMod = 1, catchUpMod, softCapMod, dailyQuestLimit ) {
        let result = {};
        for ( let key of EP_TABLE.keys() ) {
            result[key] = EPCalc.countEPSource( ep, leftExp, key, buffMod, catchUpMod, softCapMod, dailyQuestLimit );
        }
        return result;
    }

    // bigint
    static calcLeftDailyExp( epStart, expPercentStart = 0, epEnd = epStart, expPercentEnd = expPercentStart ) {
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
        return EPCalc.countEPSource(
            this._totalEP,
            this.leftDailyBonusExp( true ),
            epTableKey,
            this.buffMod,
            this._catchUpMod,
            this._softCapMod,
            this.dailyQuestLimit
        );
    }

    /**
     * Counts how many times a char can do a specific source before reaching the
     * start of soft cap.
     * @param  {number} ep              the current total EP.
     * @param  {bigint} leftExp         the current remaining ep experience.
     * @param  {string} epTableKey      the source as string key.
     * @param  {number} [buffMod=1]     the ep buff modifier. 1 by default which means "no buff".
     * @param  {number} [catchUpMod]    the catch up modifier. Calculated if not specified.
     * @param  {number} [softCapMod]    the soft cap modifier. Calculated if not specified.
     * @return {number}            the number of sources a char can do.
     */
    static countEPSource( ep, leftExp, epTableKey, buffMod = 1, catchUpMod, softCapMod, dailyQuestLimit ) {
        if ( softCapMod == undefined ) {
            let softCap = EPCalc.calcSoftCap( ep );
            softCapMod = EPCalc.calcSoftCapMod( softCap - leftExp, softCap );
        }
        let epExp = EPCalc.bonusExp( ep, epTableKey, buffMod, catchUpMod, softCapMod, false );
        let count = Math.max( Math.floor( leftExp / epExp ), 0 );
        let epObject = EP_TABLE.get( epTableKey );
        if ( count > dailyQuestLimit && count < epObject.limit ) {
            count = epObject.limit;
            leftExp -= count * epExp;
            epExp = EPCalc.bonusExp( ep, epTableKey, buffMod, catchUpMod, softCapMod, true );
            count += Math.max( Math.floor( leftExp / epExp ), 0 );
        }
        return Math.min( count, epObject.limit );
    }

    get nextHightestEPSource() {
        return EPCalc.calcNextHighestEPSource(
            this._totalEP,
            this.leftDailyBonusExp( true ),
            this.buffMod,
            this.catchUpMod,
            this.softCapMod,
            this.dailyQuestLimit
        );
    }

    static calcNextHighestEPSource( ep, leftExp, buffMod = 1, catchUpMod, softCapMod, dailyQuestLimit ) {
        let sourceCounts = EPCalc.countAllEPSources( ep, leftExp, buffMod, catchUpMod, softCapMod, dailyQuestLimit );
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
        return Math.floor( this.softCap * SOFT_CAP_CHANGE_START );
    }

    // FIXME may lead to wrong values when soft cap is accumulated
    get softCap() {
        return this._softCap != undefined ? this._softCap : this.calcSoftCap();
    }

    get lastSoftCap() {
        return this._softCap;
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

    isCatchUpModCalculated() {
        return this._catchUpMod == undefined;
    }

    isSoftCapModCalculated() {
        return this._softCapMod == undefined;
    }

    isSoftCapCalculated() {
        return this._softCap == undefined;
    }

    /**
     * Returns the (calculated) current catch up modifier.
     * @return {numbner} the current catch up modifier.
     */
    get catchUpMod() {
        return this._catchUpMod != undefined ? this._catchUpMod : this.calcCatchUpMod();
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
        return this._softCapMod != undefined ? this._softCapMod : this.calcSoftCapMod();
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

    get buff() {
        return this._buff;
    }

    get buffMod() {
        return this._buff ? this._buff.effectValue : 1;
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
        let diff = ( soft ? this.softCapStart : this.softCap ) - this._dailyExp;
        return diff;
    }

    get dailyExp() {
        return this._dailyExp;
    }

    applyBonusModifier( epObj, count ) {
        return EPCalc.applyBonusModifier(
            this._totalEP,
            epObj,
            this.buffMod,
            this.catchUpMod,
            this.softCapMod,
            count > this.dailyQuestLimit
        );
    }

    static applyBonusModifier( ep, epObj, buffMod = 1, catchUpMod, softCapMod, dailyLimitExeeded ) {
        if ( catchUpMod == undefined ) catchUpMod = EPCalc.calcCatchUpMod( ep );
        let exp = dailyLimitExeeded ? epObj.expAfterLimit : epObj.exp;
        exp = Math.ceil( ( epObj.isQuest ? VANGUARD_BONUS_MOD : 1 ) * exp );
        return Math.floor( catchUpMod * softCapMod * exp ) * buffMod;
    }

    static bonusExp( ep, source, buffMod = 1, catchUpMod, softCapMod, dailyLimitExeeded ) {
        let epObj = EP_TABLE.get( source );
        if ( !epObj ) return 0;
        let epExp = EPCalc.applyBonusModifier( ep, epObj, buffMod, catchUpMod, softCapMod, dailyLimitExeeded );
        // epExp += epObj.bams * EPCalc.applyBonusModifier( ep, EP_TABLE.get( BAM_SOURCE ) );
        return epExp;
    }
}
module.exports = EPCalc;
