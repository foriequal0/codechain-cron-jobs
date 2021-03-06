import Rpc from "codechain-rpc";
import getJailed from "./state/getJailed";
import getValidators from "./state/getValidators";

export default async function check(
    networkId: string,
    rpc: Rpc,
    blockNumber: number,
    termId: number,
    blockAuthors: Set<string>
): Promise<[Map<string, number>, Set<string>]> {
    const released = new Map<string, number>();
    // FIXME: Please remove the banned accounts.
    const previousValidators = getValidators(networkId, rpc, blockNumber - 1);
    const [previous, current] = await Promise.all([
        getJailed(networkId, rpc, blockNumber - 1),
        getJailed(networkId, rpc, blockNumber)
    ]);
    for (const [
        address,
        [deposit, custodyUntil, releaseAt]
    ] of previous.entries()) {
        if (releaseAt + 1 < termId) {
            throw Error(`Why ${address} is not released yet? #${blockNumber}`);
        }
        if (releaseAt + 1 === termId) {
            if (current.has(address)) {
                throw Error(
                    `${address} should be released at term #${releaseAt}. Current term id: ${termId}. #${blockNumber}`
                );
            }
            released.set(address, deposit);
            continue;
        }
        const jailedAddress = current.get(address);
        if (jailedAddress == null) {
            throw Error(
                `${address} should not be released yet. #${blockNumber}`
            );
        }
        if (
            deposit !== jailedAddress[0] ||
            custodyUntil !== jailedAddress[1] ||
            releaseAt !== jailedAddress[2]
        ) {
            throw Error(
                `The jailed information of ${address} has been changed. #${blockNumber}`
            );
        }
    }

    const newlyJailedAddresses = new Set(current.keys());
    for (const address of previous.keys()) {
        newlyJailedAddresses.delete(address);
    }
    const neglectingValidators = new Set((await previousValidators).keys());
    for (const address of blockAuthors) {
        neglectingValidators.delete(address);
    }
    for (const address of neglectingValidators) {
        if (!newlyJailedAddresses.has(address)) {
            throw Error(`${address} must be jailed. #${blockNumber}`);
        }
    }
    for (const address of newlyJailedAddresses) {
        if (!neglectingValidators.has(address)) {
            throw Error(`${address} should not be jailed. #${blockNumber}`);
        }
    }

    return [released, newlyJailedAddresses];
}
