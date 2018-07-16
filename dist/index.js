"use strict";
const digitalocean = require('digitalocean');
const parseArgs = require('minimist');
const { isString, isError } = require('util');
var argv = parseArgs(process.argv.slice(2));
function getCmdArg(cmdKey, defaultVal) {
    if (argv[cmdKey]) {
        return argv[cmdKey];
    }
    return defaultVal;
}
const cmdToken = getCmdArg('token', new Error('Option --token="YourToken" must be provided when using cmd mode'));
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const createPolicy = (dropletName, dropletId, snapshotKeepCount = 7, timeUnit = DAY) => ({
    dropletName,
    dropletId,
    snapshotKeepCount,
    timeUnit,
});
const Backups = (token) => {
    const tokenToUse = token || cmdToken;
    if (isError(tokenToUse)) {
        throw tokenToUse;
    }
    const client = digitalocean.client(tokenToUse);
    const getDateStr = (now, timeUnit) => {
        const strPieces = [now.getFullYear(), now.getMonth() + 1, now.getDate() + 1];
        if (timeUnit < DAY) {
            strPieces.push(now.getHours() + 1);
        }
        if (timeUnit < HOUR) {
            strPieces.push(now.getMinutes() + 1);
        }
        if (timeUnit < MINUTE) {
            strPieces.push(now.getSeconds() + 1);
        }
        return strPieces.join('-');
    };
    const deleteStaleSnapshotsBy = (policy, date = null) => {
        if (!date) {
            const lastTime = new Date();
            return deleteStaleSnapshotsBy(policy, lastTime);
        }
        const staleNames = [];
        const dateMs = date.getTime();
        for (let d = dateMs - policy.timeUnit * policy.snapshotKeepCount; d >= dateMs - (policy.timeUnit * policy.snapshotKeepCount) * 4; d -= timeUnit) {
            staleNames.push(getDateStr(new Date(d), policy.timeUnit));
        }
        const idsPromise = client.snapshots.list(1, policy.snapshotKeepCount + 10).then(snapshots => snapshots
            .filter(snapshot => snapshot.name in staleNames)
            .map(snapshot => snapshot.id));
        const toAwait = [];
        const deletionPromises = idsPromise.then(ids => ids.forEach(id => toAwait.push(client.snapshot.delete(id))));
        return Promise.all(toAwait).then(results => {
            console.log(`Deleted ${toAwait.length} snapshots`);
        })
            .catch(e => {
            `Could not delete snapshot ${e}`;
        });
    };
    const runPolicy = (policy) => {
        const dateStr = getDateStr(new Date(), policy.timeUnit);
        const name = `${policy.dropletName}-${dateStr}`;
        console.log(`Creating snapshot ${name} for ${policy.dropletId}`);
        const snapshotting = client.droplets.snapshot(policy.dropletId, name);
        snapshotting.then(() => {
            console.log(`Done creating snapshot ${name}`);
            deleteStaleSnapshotsBy(policy);
        })
            .catch(e => {
            console.log(`Error creating snapshot! ${e}`);
        });
    };
    const parseOrThrowField = (fieldName) => {
        const value = getCmdArg(fieldName, new Error(`Option --${fieldName} must be specified`));
        if (isError(value)) {
            throw value;
        }
        return value;
    };
    const runPolicyCmd = () => {
        const dropletName = parseOrThrowField('dropletName');
        const dropletId = parseOrThrowField('dropletId');
        const policy = createPolicy(dropletName, dropletId);
        policy.timeUnit = parseInt(getCmdArg('timeUnit', policy.timeUnit));
        policy.snapshotKeepCount = parseInt(getCmdArg('snapshotKeepCount', policy.snapshotKeepCount));
        return runPolicy(policy);
    };
    const takeSnapshot = (dropletId, name) => {
        return client.droplets.snapshot(dropletId);
    };
    const takeSnapshotCmd = () => {
        const name = parseOrThrowField('name');
        const dropletId = parseOrThrowField('dropletId');
        return takeSnapshot(dropletId, name);
    };
    return {
        runPolicy,
        runPolicyCmd,
        takeSnapshot,
        takeSnapshotCmd,
    };
};
module.exports = {
    MINUTE,
    HOUR,
    DAY,
    createPolicy,
    Backups,
};
//# sourceMappingURL=index.js.map