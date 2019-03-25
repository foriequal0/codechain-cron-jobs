import { PlatformAddress, U64, U64Value } from "codechain-primitives/lib";
import { Transaction } from "codechain-sdk/lib/core/Transaction";

import { Action } from "./actions/Action";
import { ChangeAssetScheme } from "./actions/ChangeAssetScheme";
import { Transfer, TransferOutput } from "./actions/Transfer";
import { ACCOUNTS, REGULATOR, REGULATOR_ALT } from "./configs";
import { State, Utxo } from "./State";
import { pickRandom } from "./util";

function give(
    utxo: Utxo,
    sender: PlatformAddress,
    receiver: PlatformAddress,
    quantity: U64Value,
): TransferOutput[] {
    return [
        {
            assetType: utxo.asset.assetType,
            receiver: sender,
            type: "p2pkh",
            quantity: utxo.asset.quantity.minus(quantity),
        },
        {
            assetType: utxo.asset.assetType,
            receiver,
            type: "p2pkh",
            quantity: U64.ensure(quantity),
        },
    ];
}

export class Skip {
    public readonly reason: string;

    public constructor(reason: string) {
        this.reason = reason;
    }
}

interface ScenarioResult {
    expected: boolean;
    action: Action<Transaction>;
}

type Scenario = (state: State) => Promise<ScenarioResult | Skip>;

export const scenarios: {
    weight: number;
    scenario: Scenario;
}[] = [
    {
        weight: 10,
        scenario: async function airDrop(state: State) {
            const utxo = pickRandom(
                state.getUtxos(REGULATOR),
                x =>
                    x.asset.quantity.isGreaterThanOrEqualTo(10) &&
                    state.getAssetScheme(x.asset.assetType).registrar!.value === REGULATOR.value,
            );
            if (!utxo) {
                return new Skip("Asset is depleted");
            }
            return {
                expected: true,
                action: await Transfer.create({
                    sender: REGULATOR,
                    inputs: [utxo!],
                    outputs: give(utxo, REGULATOR, pickRandom(ACCOUNTS)!, 10),
                }),
            };
        },
    },
    {
        weight: 1,
        scenario: async function tryAirDropOthers(state: State) {
            const utxo = pickRandom(
                state.getUtxos(REGULATOR),
                x =>
                    x.asset.quantity.isGreaterThanOrEqualTo(10) &&
                    state.getAssetScheme(x.asset.assetType).registrar!.value !== REGULATOR.value,
            );
            if (!utxo) {
                return new Skip("Asset is depleted");
            }
            return {
                expected: false,
                action: await Transfer.create({
                    sender: REGULATOR,
                    inputs: [utxo!],
                    outputs: give(utxo, REGULATOR, pickRandom(ACCOUNTS)!, 10),
                }),
            };
        },
    },
    {
        weight: 1,
        scenario: async function airdropOthersButWithApprovals(state: State) {
            const utxo = pickRandom(
                state.getUtxos(REGULATOR),
                x =>
                    x.asset.quantity.isGreaterThanOrEqualTo(10) &&
                    state.getAssetScheme(x.asset.assetType).registrar!.value !== REGULATOR.value,
            );
            if (!utxo) {
                return new Skip("Asset is depleted");
            }
            return {
                expected: true,
                action: await Transfer.create({
                    sender: REGULATOR,
                    approvers: [REGULATOR_ALT],
                    inputs: [utxo!],
                    outputs: give(utxo, REGULATOR, pickRandom(ACCOUNTS)!, 10),
                }),
            };
        },
    },
    {
        weight: 1,
        scenario: async function registrarChangesRegistrarOfAssetScheme(state: State) {
            const [assetType, assetScheme] = pickRandom(state.allAssetSchemes())!;
            const currentRegistrar = assetScheme.registrar!;
            const otherRegistrar =
                currentRegistrar.value === REGULATOR.value ? REGULATOR_ALT : REGULATOR;
            return {
                expected: true,
                action: await ChangeAssetScheme.create({
                    assetType,
                    assetScheme,
                    sender: currentRegistrar,
                    changes: {
                        registrar: otherRegistrar,
                    },
                }),
            };
        },
    },
];
