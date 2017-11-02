/**
 * Copyright (c) 2017 molio contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import Query from './query'
//import Selection from './selection'
import * as P from './properties'
import { AtomSet, Atom } from '../structure'
import { OrderedSet } from '../../mol-base/collections/integer'

export interface AtomGroupsSpec {
    entityTest: Atom.Predicate,
    chainTest: Atom.Predicate,
    residueTest: Atom.Predicate,
    atomTest: Atom.Predicate,
    groupBy: Atom.Property<any>
}

export const all: Query = s => s;

export function atomGroups(spec?: Partial<AtomGroupsSpec>): Query {
    if (!spec || (!spec.atomTest && !spec.residueTest && !spec.chainTest && !spec.entityTest && !spec.groupBy)) return all;
    if (!!spec.atomTest && !spec.residueTest && !spec.chainTest && !spec.entityTest && !spec.groupBy) return atomGroupsLinear(spec.atomTest);

    const normalized: AtomGroupsSpec = {
        entityTest: spec.entityTest || P.constant.true,
        chainTest: spec.entityTest || P.constant.true,
        residueTest: spec.residueTest || P.constant.true,
        atomTest: spec.atomTest || P.constant.true,
        groupBy: spec.entityTest || P.constant.zero,
    };

    if (!spec.groupBy) return atomGroupsSegmented(normalized)
    return atomGroupsGrouped(normalized);
}

function atomGroupsLinear(atomTest: Atom.Predicate): Query {
    return structure => {
        const { atoms, units } = structure;
        const unitIds = AtomSet.unitIds(atoms);
        const l = Atom.Location();
        const builder = AtomSet.Builder(atoms);

        for (let i = 0, _i = unitIds.length; i < _i; i++) {
            const unitId = unitIds[i];
            l.unit = units[unitId];
            const set = AtomSet.unitGetByIndex(atoms, i);

            builder.beginUnit();
            for (let j = 0, _j = OrderedSet.size(set); j < _j; j++) {
                l.atom = OrderedSet.getAt(set, j);
                if (atomTest(l)) builder.addToUnit(l.atom);
            }
            builder.commitUnit(unitId);
        }

        return { units, atoms: builder.getSet() };
    };
}

function atomGroupsSegmented({ entityTest, chainTest, residueTest, atomTest }: AtomGroupsSpec): Query {
    return structure => {


        throw 'nyi'
    };
}

function atomGroupsGrouped({ entityTest, chainTest, residueTest, atomTest, groupBy }: AtomGroupsSpec): Query {
    return structure => {


        throw 'nyi'
    };
}

// class LinearGroupingBuilder {

// }