/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Canvas3DProps } from '../../mol-canvas3d/canvas3d';
import { createPlugin } from '../../mol-plugin';
import { DefaultPluginSpec } from '../../mol-plugin/spec';
import { BuiltInTrajectoryFormat } from '../../mol-plugin-state/formats/trajectory';
import { PluginCommands } from '../../mol-plugin/commands';
import { PluginContext } from '../../mol-plugin/context';
import './index.html';
import { Asset } from '../../mol-util/assets';
require('mol-plugin-ui/skin/light.scss');

type LoadParams = { url: string, format?: BuiltInTrajectoryFormat, isBinary?: boolean, assemblyId?: string }

type _Preset = Pick<Canvas3DProps, 'multiSample' | 'postprocessing' | 'renderer'>
type Preset = { [K in keyof _Preset]: Partial<_Preset[K]> }

const Canvas3DPresets = {
    illustrative: <Preset> {
        multiSample: {
            mode: 'temporal' as Canvas3DProps['multiSample']['mode']
        },
        postprocessing: {
            occlusion: { name: 'on', params: { samples: 64, radius: 8, bias: 1.0, blurKernelSize: 13 } },
            outline: { name: 'on', params: { scale: 1, threshold: 0.33 } }
        },
        renderer: {
            ambientIntensity: 1,
            lightIntensity: 0,
        }
    },
    occlusion: <Preset> {
        multiSample: {
            mode: 'temporal' as Canvas3DProps['multiSample']['mode']
        },
        postprocessing: {
            occlusion: { name: 'on', params: { samples: 64, radius: 8, bias: 1.0, blurKernelSize: 13 } },
            outline: { name: 'off', params: { } }
        },
        renderer: {
            ambientIntensity: 0.4,
            lightIntensity: 0.6,
        }
    },
    standard: <Preset> {
        multiSample: {
            mode: 'off' as Canvas3DProps['multiSample']['mode']
        },
        postprocessing: {
            occlusion: { name: 'off', params: { } },
            outline: { name: 'off', params: { } }
        },
        renderer: {
            ambientIntensity: 0.4,
            lightIntensity: 0.6,
        }
    }
};

type Canvas3DPreset = keyof typeof Canvas3DPresets

class LightingDemo {
    plugin: PluginContext;

    init(target: string | HTMLElement) {
        this.plugin = createPlugin(typeof target === 'string' ? document.getElementById(target)! : target, {
            ...DefaultPluginSpec(),
            layout: {
                initial: {
                    isExpanded: false,
                    showControls: false
                },
                controls: { left: 'none', right: 'none', top: 'none', bottom: 'none' }
            }
        });

        this.setPreset('illustrative');
    }

    setPreset(preset: Canvas3DPreset) {
        const props = Canvas3DPresets[preset];
        PluginCommands.Canvas3D.SetSettings(this.plugin, { settings: {
            ...props,
            multiSample: {
                ...this.plugin.canvas3d!.props.multiSample,
                ...props.multiSample
            },
            renderer: {
                ...this.plugin.canvas3d!.props.renderer,
                ...props.renderer
            },
            postprocessing: {
                ...this.plugin.canvas3d!.props.postprocessing,
                ...props.postprocessing
            },
        }});
    }

    async load({ url, format = 'mmcif', isBinary = false, assemblyId = '' }: LoadParams) {
        await this.plugin.clear();

        const data = await this.plugin.builders.data.download({ url: Asset.Url(url), isBinary }, { state: { isGhost: true } });
        const trajectory = await this.plugin.builders.structure.parseTrajectory(data, format);
        const model = await this.plugin.builders.structure.createModel(trajectory);
        const structure = await this.plugin.builders.structure.createStructure(model, assemblyId ? { name: 'assembly', params: { id: assemblyId } } : { name: 'model', params: { } });

        const polymer = await this.plugin.builders.structure.tryCreateComponentStatic(structure, 'polymer');
        if (polymer) await this.plugin.builders.structure.representation.addRepresentation(polymer, { type: 'spacefill', color: 'illustrative' });

        const ligand = await this.plugin.builders.structure.tryCreateComponentStatic(structure, 'ligand');
        if (ligand) await this.plugin.builders.structure.representation.addRepresentation(ligand, { type: 'ball-and-stick' });
    }
}

(window as any).LightingDemo = new LightingDemo();