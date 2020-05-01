const EP_SOURCES = require( "./data/ep-sources" );
const FILTERED_SOURCES = new Map([...EP_SOURCES.entries()].filter( ([k, v]) => v.asFiller /* && k != "bam"*/ ) );
const binarySearch = require( "binary-search" );
const { BloomFilter } = require( "bloomfilter" );
const { FibonacciHeap } = require( "@tyriar/fibonacci-heap" );
const AVLTree = require( "avl" );

function simplifiedKeyMap( map ) {
    const start = "A".charCodeAt( 0 );
    const limit = "Z".charCodeAt( 0 );
    let charCodes = [start];
    let simpleMap = new Map();
    let simpleId;
    for ( let [id, _unused] of map ) {
        simpleId = "";
        for ( let c of charCodes ) {
            simpleId += String.fromCharCode( c );
        }
        simpleMap.set( id, simpleId );
        let extend = true;
        for ( let i = charCodes.length - 1; i >= 0; i-- ) {
            if ( charCodes[i] >= limit ) {
                charCodes[i] = start;
            } else {
                extend = false;
                charCodes[i]++;
                break;
            }
        }
        if ( extend ) charCodes.push( start );
    }
    return simpleMap;
}
const SOURCE_MAP = simplifiedKeyMap( FILTERED_SOURCES );

class EPSource {
    constructor( epExp, time, limit ) {
        this.epExp = epExp;
        this.time = time;
        this.limit = limit;
        this.completed = false;
    }

    isCompleted() {
        return this.completed;
    }

    complete() {
        this.completed = true;
    }
}

class Quest extends EPSource {
    constructor( epExp, time, limit, matchListIds ) {
        super( epExp, time, limit );
        this.matchListIds = matchListIds;
    }
}

class QuestGroup {}

class Bam extends EPSource {
    constructor( epExp, time, limit, count ) {
        super( epExp, time, limit );
        this.count = count;
    }
}

class LevelUp extends EPSource {
    constructor( epExp, time, limit, first ) {
        super( epExp, time, limit );
        this.first = first;
    }
}

class Enchantment extends EPSource {
    constructor( epExp, time, limit, equip, enchantLvl ) {
        super( epExp, time, limit );
        this.equip = equip;
        this.enchantLvl = enchantLvl;
    }
}

class EPOrganizer {
    constructor( epc ) {
        this.epc = epc;
        // this.mod = epc.mod;
        this.queue = [];
        let minMaxAvl = new AVLTree( ( a, b ) => a - b );
        for ( let [id, source] of FILTERED_SOURCES ) minMaxAvl.insert( source.exp, id );
        this.minSource = minMaxAvl.minNode().data;
        this.maxSource = minMaxAvl.maxNode().data;
        minMaxAvl.clear();
        for ( let [id, source] of FILTERED_SOURCES ) minMaxAvl.insert( source.exp / source.time, id );
        this.minEfficientSource = minMaxAvl.minNode().data;
        this.maxEfficientSource = minMaxAvl.maxNode().data;
        this.bamExp = this.epc.applyBonusModifier( EP_SOURCES.get( "bam" ), false );
        this._limitBeforeSeperation = 5060 * this.epc.catchUpMod;
    }

    get limitBeforeSeperation() {
        return this._limitBeforeSeperation;
    }

    set limitBeforeSeperation( limit ) {
        if( limit == undefined ) this._limitBeforeSeperation = limit;
    }

    bestFirstSearch( problem, evaluationFn ) {
        let node = new SearchNode( problem.initialState );
        // let frontier = new FibonacciHeap( ( a, b ) => evaluationFn( a ) - evaluationFn( b ) );
        let frontier = new AVLTree( ( a, b ) => evaluationFn( a ) - evaluationFn( b ) );
        // let frontier = [node];

        frontier.insert( node ); // a priority queue ordered by ascending evaluationFn, only element n
        let explored = new BloomFilter( 2 * 1024 * 1024, 7 ); // empty set of states
        let exploredCount = 0;
        let maxFrontierCount = 1;
        let frontierSize = 1;
        while ( frontierSize > 0 ) {
            // let n = frontier.extractMinimum().key; // fibonacci
            let n = frontier.pop().key; // avl
            // let n = frontier.pop(); // array
            frontierSize--;
            if ( problem.isGoal( n.state ) ) {
                let solution = n.getSolution();
                let leftExp = n.state.leftExp;
                let bamExp = n.state.epc.applyBonusModifier( EP_SOURCES.get( "bam" ), 1 );
                while ( leftExp >= bamExp ) {
                    leftExp -= bamExp;
                    solution.push( "bam" );
                }
                return solution;
            }
            if ( !explored.test( n.state ) ) {
                explored.add( n.state );
                exploredCount++;
            }
            for ( let action of problem.getActions( n.state ) ) {
                let child = problem.getChildNode( n, action );
                if ( !explored.test( child.state ) ) {
                    // let idx = binarySearch( frontier, child, ( a, b ) => evaluationFn( b ) - evaluationFn( a ) );
                    // if ( idx < 0 ) idx = ~idx;
                    // frontier.splice( idx, 0, child ); // array

                    frontier.insert( child );
                    explored.add( child.state );
                    frontierSize++;
                    exploredCount++;
                }
            }
            if ( frontierSize > maxFrontierCount ) maxFrontierCount = frontierSize;
        }
        console.log( `explored: ${exploredCount}, maxFrontier: ${maxFrontierCount}` );
        return null;
    }

    bestTimePath( leftExp = this.epc.leftDailyBonusExp( true ) ) {
        let bamExp = this.bamExp;
        // efficient
        function efficientCost( action, state ) {
            let value = EP_SOURCES.get( action );
            let count = state.actionCounter.get( "bam" );
            let bamTime = EP_SOURCES.get( "bam" ).time;
            return value.time + count*bamTime;
        }

        function efficientEval( node ) {
            return node.pathCost;
        }

        function efficientGoal( state ) {
            return state.leftExp < 20 * bamExp && state.leftExp >= 0;
        }
        let cap = leftExp < this.limitBeforeSeperation ? leftExp : this.limitBeforeSeperation;

        let result = [];
        while ( leftExp > 0 ) {
            let initialState = new EPSearchState( cap, this.epc );
            let problem = new Problem(
                initialState,
                state => state.getActions(),
                ( state, action ) => state.next( action ),
                efficientCost,
                efficientGoal
            );
            // console.profile( "TIME" );
            console.time( "TIME-time" );
            let tmpResult = this.bestFirstSearch( problem, efficientEval );
            console.timeEnd( "TIME-time" );
            // console.profileEnd( "TIME" );
            let count = Math.max( Math.floor( leftExp / this.limitBeforeSeperation ), 1 );
            for ( let i = 0; i < count; i++ ) result = result.concat( tmpResult );
            leftExp -= count * cap;
            cap = leftExp;
        }
        return result;
    }

    /**
     * Fill with mostEfficientExp when over limit. Calculate path when under limit.
     * @param  {[type]} [leftExp=this.epc.leftDailyBonusExp( true          )] [description]
     * @return {[type]}                                      [description]
     */
    bestTimePath2( leftExp = this.epc.leftDailyBonusExp( true ) ) {
        let bamExp = this.bamExp;
        // efficient
        function efficientCost( action, state ) {
            let value = EP_SOURCES.get( action );
            let count = state.actionCounter.get( "bam" );
            let bamTime = EP_SOURCES.get( "bam" ).time;
            return value.time + count*bamTime;
        }

        function efficientEval( node ) {
            return node.pathCost;
        }

        function efficientGoal( state ) {
            return state.leftExp < 20 * bamExp && state.leftExp >= 0;
        }
        let cap = leftExp < this.limitBeforeSeperation ? leftExp : this.limitBeforeSeperation;
        let maxEfficientSourceExp = this.epc.applyBonusModifier( EP_SOURCES.get(this.maxEfficientSource) );
        let efficientSourceCount = Math.max( Math.floor( (leftExp - this.limitBeforeSeperation) / maxEfficientSourceExp), 0);

        let result = [];
        result.fill(this.maxEfficientSource, 0, efficientSourceCount - 1);
        leftExp -= efficientSourceCount
          let initialState = new EPSearchState( cap, this.epc );
          let problem = new Problem(
              initialState,
              state => state.getActions(),
              ( state, action ) => state.next( action ),
              efficientCost,
              efficientGoal
          );
          // console.profile( "TIME" );
          console.time( "TIME-time" );
          let tmpResult = this.bestFirstSearch( problem, efficientEval );
          console.timeEnd( "TIME-time" );
          // console.profileEnd( "TIME" );
          let count = Math.max( Math.floor( leftExp / this.limitBeforeSeperation ), 1 );
          result = result.concat( tmpResult );
        return result;
    }

    bestMixPath( leftExp = this.epc.leftDailyBonusExp( true ) ) {
        let bamExp = this.bamExp;
        // efficient+effective
        function bestMixCost( action, state ) {
            let value = EP_SOURCES.get( action );
            let count = state.actionCounter.get( "bam" );
            let bamTime = EP_SOURCES.get( "bam" ).time;
            return value.time + count * bamTime;
        }

        function bestMixEval( node ) {
            return node.pathCost;
        }

        function bestMixGoal( state ) {
            return state.leftExp < 20 * bamExp && state.leftExp % 30 == goal && state.leftExp >= 0;
        }
        let goal = 0;
        let cap = leftExp < this.limitBeforeSeperation ? leftExp : this.limitBeforeSeperation;

        let result = [];
        if ( leftExp >= this.limitBeforeSeperation ) {
            let initialState = new EPSearchState( cap, this.epc );
            let problem = new Problem(
                initialState,
                state => state.getActions(),
                ( state, action ) => state.next( action ),
                bestMixCost,
                bestMixGoal
            );
            // console.profile( "MIX-over-limit" );
            console.time( "MIX-time-over-limit" );
            let tmpResult = this.bestFirstSearch( problem, bestMixEval );
            console.timeEnd( "MIX-time-over-limit" );
            // console.profileEnd( "MIX-over-limit" );
            let count = Math.max( Math.floor( leftExp / this.limitBeforeSeperation ), 1 );
            for ( let i = 0; i < count; i++ ) result = result.concat( tmpResult );
            leftExp -= count * cap;
        }

        let lastResult = null;
        while ( lastResult == null && goal < bamExp ) {
            let initialState = new EPSearchState( leftExp, this.epc );
            let problem = new Problem(
                initialState,
                state => state.getActions(),
                ( state, action ) => state.next( action ),
                bestMixCost,
                bestMixGoal
            );
            // console.profile( "MIX-" + goal );
            console.time( "MIX-time-" + goal );
            lastResult = this.bestFirstSearch( problem, bestMixEval );
            console.timeEnd( "MIX-time-" + goal );
            // console.profileEnd( "MIX-" + goal );
            goal++;
        }
        console.log( `Best time search in ${goal} tries...` );
        return result.concat( lastResult );
    }

    bestFitPath( leftExp = this.epc.leftDailyBonusExp( true ) ) {
        let maxSource = EP_SOURCES.get( this.maxSource );
        let bamExp = this.bamExp;
        let mostExp = this.epc.applyBonusModifier( maxSource, 1 );
        mostExp += maxSource.bams * bamExp;
        // effective
        function bestFitCost( action, state ) {
            let value = EP_SOURCES.get( action );
            let count = state.actionCounter.get( action );
            let exp = state.epc.applyBonusModifier( value, count ) + value.bams * bamExp;
            return mostExp - exp;
        }

        function bestFitEval( node ) {
            return node.pathCost;
        }

        function bestFitGoal( state ) {
            return state.leftExp < 20 * bamExp && state.leftExp % 30 == goal && state.leftExp >= 0;
        }

        let goal = 0;
        let cap = leftExp < this.limitBeforeSeperation ? leftExp : this.limitBeforeSeperation;

        let result = [];
        if ( leftExp >= this.limitBeforeSeperation ) {
            let initialState = new EPSearchState( cap, this.epc );
            let problem = new Problem(
                initialState,
                state => state.getActions(),
                ( state, action ) => state.next( action ),
                bestFitCost,
                bestFitGoal
            );
            // console.profile( "FIT-over-limit" );
            console.time( "FIT-time-over-limit" );
            let tmpResult = this.bestFirstSearch( problem, bestFitEval );
            console.timeEnd( "FIT-time-over-limit" );
            // console.profileEnd( "FIT-over-limit" );
            let count = Math.max( Math.floor( leftExp / this.limitBeforeSeperation ), 1 );
            for ( let i = 0; i < count; i++ ) result = result.concat( tmpResult );
            leftExp -= count * cap;
        }

        let lastResult = null;
        while ( lastResult == null && goal < bamExp ) {
            let initialState = new EPSearchState( leftExp, this.epc );
            let problem = new Problem(
                initialState,
                state => state.getActions(),
                ( state, action ) => state.next( action ),
                bestFitCost,
                bestFitGoal
            );
            // console.profile( "FIT-" + goal );
            console.time( "FIT-time-" + goal );
            lastResult = this.bestFirstSearch( problem, bestFitEval );
            console.timeEnd( "FIT-time-" + goal );
            // console.profileEnd( "FIT-" + goal );
            goal++;
        }
        console.log( `Best fit search in ${goal} tries...` );
        return result.concat( lastResult );
    }

    countSources( sourceList ) {
        let counts = {};
        for ( let source of sourceList ) {
            if ( source === "bam" ) counts[source] += source;
            else counts[source] = counts[source] != undefined ? counts[source] + 1 : 1;
        }
        return counts;
    }
}

class SearchNode {
    constructor( state, action, pathCost = 0, parent ) {
        this.state = state;
        this.parent = parent;
        this.action = action;
        this.pathCost = pathCost;
        this.depth = this.parent ? this.parent.depth + 1 : 0;
    }

    getSolution() {
        if ( this.parent ) {
            let path = this.parent.getSolution();
            path.push( this.action );
            return path;
        }
        return [];
    }

    // equals( node ) {
    //     return this.state.equals( node.state );
    // }
}

class EPSearchState {
    constructor( leftExp, epc, actionCounter ) {
        this.leftExp = leftExp;
        this.epc = epc;
        if ( !actionCounter ) {
            actionCounter = new Map();
            for ( let key of FILTERED_SOURCES.keys() ) actionCounter.set( key, 0 );
        }
        this.actionCounter = actionCounter;
    }

    next( action ) {
        let source = FILTERED_SOURCES.get( action );
        let actionCounter = new Map( this.actionCounter );
        let count = actionCounter.get( action );
        if ( count == undefined ) count = 0;
        actionCounter.set( action, ++count );
        // XXX substract bam exp DELETE
        let bamExp = source.bams * this.epc.applyBonusModifier( EP_SOURCES.get( "bam" ), 0 );
        let exp = this.epc.applyBonusModifier( source, count ) + bamExp;
        let leftExp = this.leftExp - exp;
        return new EPSearchState( leftExp, this.epc, actionCounter );
    }

    getActions() {
        let actions = [];
        for ( let [key, value] of FILTERED_SOURCES ) {
            let count = this.actionCounter.get( key );
            let bamExp = value.bams * this.epc.applyBonusModifier( EP_SOURCES.get( "bam" ), 0 );
            let exp = this.epc.applyBonusModifier( value, count ) + bamExp;
            if ( exp <= this.leftExp && count < value.limit ) actions.push( key );
        }
        return actions;
    }

    equals( state ) {
        if ( this.leftExp != state.leftExp ) return false;
        for ( let [key, value] of this.actionCounter ) if ( state.actionCounter.get( key ) != value ) return false;
        return true;
    }

    toString() {
        let string = "";
        for ( let x of this.actionCounter ) string += SOURCE_MAP.get( x[0]) + x[1];
        return string;
    }
}

class Problem {
    constructor( initialState, actionFn, transitionFn, costFn, goalFn ) {
        this.initialState = initialState;
        this.getActions = actionFn; // (state) -> action
        this.getChildState = transitionFn; // (state, action) -> state
        this.getCost = costFn; // (action) -> number >= 0
        this.isGoal = goalFn; // (node) -> bool
    }

    getChildNode( node, action ) {
        let pathCost = node.pathCost + this.getCost( action, node.state );
        let state = this.getChildState( node.state, action );
        return new SearchNode( state, action, pathCost, node );
    }
}

module.exports = EPOrganizer;
