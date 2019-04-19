/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */

import { AtomicHierarchy, AtomicConformation } from 'mol-model/structure/model/properties/atomic';
import { SortedArray } from 'mol-data/int';
import { IntAdjacencyGraph } from 'mol-math/graph';
import { ResidueIndex } from 'mol-model/structure';
import { GridLookup3D } from 'mol-math/geometry';
import { Vec3 } from 'mol-math/linear-algebra';
import { DsspHbonds, BackboneAtomIndices } from './common';

/** max distance between two C-alpha atoms to check for hbond */
const caMaxDist = 9.0;

/**
 * Constant for electrostatic energy in kcal/mol
 *      f  *  q1 *   q2
 * Q = -332 * 0.42 * 0.20
 *
 * f is the dimensional factor
 *
 * q1 and q2 are partial charges which are placed on the C,O
 * (+q1,-q1) and N,H (-q2,+q2)
 */
const Q = -27.888

/** cutoff for hbonds in kcal/mol, must be lower to be consider as an hbond */
const hbondEnergyCutoff = -0.5
/** prevent extremely low hbond energies */
const hbondEnergyMinimal = -9.9

/**
 * E = Q * (1/r(ON) + l/r(CH) - l/r(OH) - l/r(CN))
 */
function calcHbondEnergy(oPos: Vec3, cPos: Vec3, nPos: Vec3, hPos: Vec3) {
    const distOH = Vec3.distance(oPos, hPos)
    const distCH = Vec3.distance(cPos, hPos)
    const distCN = Vec3.distance(cPos, nPos)
    const distON = Vec3.distance(oPos, nPos)

    const e1 = Q / distOH - Q / distCH
    const e2 = Q / distCN - Q / distON
    const e = e1 + e2

    // cap lowest possible energy
    if (e < hbondEnergyMinimal)
        return hbondEnergyMinimal

    return e
}

export function calcBackboneHbonds(hierarchy: AtomicHierarchy, conformation: AtomicConformation, proteinResidues: SortedArray<ResidueIndex>, backboneIndices: BackboneAtomIndices, lookup3d: GridLookup3D): DsspHbonds {
    const { cIndices, hIndices, nIndices, oIndices } = backboneIndices
    const { index } = hierarchy
    const { x, y, z } = conformation
    const { traceElementIndex } = hierarchy.derived.residue

    const residueCount = proteinResidues.length
    const position = (i: number, v: Vec3) => Vec3.set(v, x[i], y[i], z[i])

    const oAtomResidues: number[] = [];
    const nAtomResidues: number[] = [];
    const energies: number[] = [];

    const oPos = Vec3()
    const cPos = Vec3()
    const caPos = Vec3()
    const nPos = Vec3()
    const hPos = Vec3()

    const cPosPrev = Vec3()
    const oPosPrev = Vec3()

    for (let i = 0, il = proteinResidues.length; i < il; ++i) {
        const oPI = i
        const oRI = proteinResidues[i]

        const oAtom = oIndices[oPI]
        const cAtom = cIndices[oPI]
        const caAtom = traceElementIndex[oRI]

        // continue if residue is missing O or C atom
        if (oAtom === -1 || cAtom === -1) continue

        // ignore C-terminal residue as acceptor
        if (index.findAtomOnResidue(oRI, 'OXT') !== -1) continue

        position(oAtom, oPos)
        position(cAtom, cPos)
        position(caAtom, caPos)

        const { indices, count } = lookup3d.find(caPos[0], caPos[1], caPos[2], caMaxDist)

        for (let j = 0; j < count; ++j) {
            const nPI = indices[j]

            // ignore bonds within a residue or to prev or next residue, TODO take chain border into account
            if (nPI === oPI || nPI - 1 === oPI || nPI + 1 === oPI) continue

            const nAtom = nIndices[nPI]
            if (nAtom === -1) continue

            position(nAtom, nPos)

            const hAtom = hIndices[nPI]
            if (hAtom === -1) {
                // approximate calculation of H position, TODO factor out
                if (nPI === 0) continue
                const nPIprev = nPI - 1

                const oAtomPrev = oIndices[nPIprev]
                const cAtomPrev = cIndices[nPIprev]
                if (oAtomPrev === -1 || cAtomPrev === -1) continue

                position(oAtomPrev, oPosPrev)
                position(cAtomPrev, cPosPrev)

                Vec3.sub(hPos, cPosPrev, oPosPrev)
                const dist = Vec3.distance(oPosPrev, cPosPrev)
                Vec3.scaleAndAdd(hPos, nPos, hPos, 1 / dist)
            } else {
                position(hAtom, hPos)
            }

            const e = calcHbondEnergy(oPos, cPos, nPos, hPos)
            if (e > hbondEnergyCutoff) continue

            oAtomResidues[oAtomResidues.length] = oPI
            nAtomResidues[nAtomResidues.length] = nPI
            energies[energies.length] = e
        }
    }

    return buildHbondGraph(residueCount, oAtomResidues, nAtomResidues, energies);
}

function buildHbondGraph(residueCount: number, oAtomResidues: number[], nAtomResidues: number[], energies: number[]) {
    const builder = new IntAdjacencyGraph.DirectedEdgeBuilder(residueCount, oAtomResidues, nAtomResidues);
    const _energies = new Float32Array(builder.slotCount);

    for (let i = 0, _i = builder.edgeCount; i < _i; i++) {
        builder.addNextEdge();
        builder.assignProperty(_energies, energies[i]);
    }

    return builder.createGraph({ energies });
}