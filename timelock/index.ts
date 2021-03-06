import CodeChain from "./src/codeChain";
import { runTimelockInInput, runTimelockInOutput } from "./src/scenario";
import { SlackNotification } from "./src/slackNotification";
import { delay } from "./src/util";

const MAX_ERROR_COUNT = 4;

async function main() {
    const codeChain = new CodeChain();
    let errorCount = 0;
    while (true) {
        try {
            await runTimelockInOutput(codeChain, "time");
            await runTimelockInOutput(codeChain, "timeAge");
            await runTimelockInOutput(codeChain, "block");
            await runTimelockInOutput(codeChain, "blockAge");
            await runTimelockInInput(codeChain, "time");
            await runTimelockInInput(codeChain, "timeAge");
            await runTimelockInInput(codeChain, "block");
            await runTimelockInInput(codeChain, "blockAge");
            errorCount = 0;
        } catch (err) {
            console.error(err);
            SlackNotification.instance.sendError(err);

            errorCount += 1;
            if (errorCount > MAX_ERROR_COUNT) {
                errorCount = MAX_ERROR_COUNT;
            }
        }

        const delaySeconds = Math.pow(10, errorCount);
        await delay(delaySeconds * 1000);
    }
}

main()
    .then(() => console.log("finish"))
    .catch(err => console.error(err));
