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

const cmdToken = getCmdArg('token', new Error('Option --token="YourToken" must be provided when using cmd mode'))

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const createPolicy = (
    dropletName,
    dropletId,
    snapshotKeepCount = 7,  // Keep the last X snapshots taken
    timeUnit = DAY, // # milliseconds between run invokations, default is 1 day
) => ({
    dropletName,
    dropletId,
    snapshotKeepCount,
    timeUnit,
});

// Either manually pass in your token or it will be read from command line
const Backups = (token) => {
    const tokenToUse = token || cmdToken
    if (isError(tokenToUse)) {
        throw tokenToUse
    }
    const client = digitalocean.client(tokenToUse);

    const getDateStr = (now, timeUnit) => {
        const strPieces = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
        if (timeUnit < DAY) {
            strPieces.push(now.getHours() + 1)
        }
        if (timeUnit < HOUR) {
            strPieces.push(now.getMinutes() + 1)
        }
        if (timeUnit < MINUTE) {
            strPieces.push(now.getSeconds() + 1)
        }
        return strPieces.join('-')
    };

    const deleteStaleSnapshotsBy = (policy, date = null) => {
        if (!date) {
            const lastTime = new Date()
            return deleteStaleSnapshotsBy(policy, lastTime)
        }

        const staleNames = []
        const dateMs = date.getTime()

        // Delete up to 2 * snapshotKeepCount
        for (let d = dateMs - policy.timeUnit * policy.snapshotKeepCount; d >= dateMs - (policy.timeUnit * policy.snapshotKeepCount) * 4; d -= policy.timeUnit) {
            staleNames.push(policy.dropletName + '-' + getDateStr(new Date(d), policy.timeUnit))
        }

        const idsPromise = client.droplets.snapshots(policy.dropletId, 1, policy.snapshotKeepCount + 10)
          .then(snapshots =>
            snapshots
                .filter((snapshot) => {
			const matches = staleNames.indexOf(snapshot.name) >= 0;
			if (matches) {
				console.log(`Deleting ${snapshot.name}`)
			}
			return matches
		})
                .map(snapshot => snapshot.id)
          )

        const toAwait = idsPromise.then(ids =>
            ids.map(id => client.snapshots.delete(id)
	))

        return toAwait
		.then(results => {
            		console.log(`Deleted ${results.length} snapshots`)
        	})
            	.catch(e => {
                	`Could not delete snapshot ${e}`
            	})
    };

    // Be sure to only run this once every policy.timeUnit milliseconds or you'll get unexpected behavior!
    const runPolicy = (policy) => {
        // First, create a snapshot of current state
        const dateStr = getDateStr(new Date(), policy.timeUnit)
        const name = `${policy.dropletName}-${dateStr}`

        console.log(`Creating snapshot ${name} for ${policy.dropletId}`)
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
        const value = getCmdArg(fieldName, new Error(`Option --${fieldName} must be specified`))
        if (isError(value)) {
            throw value
        }
        return value
    }

    // Pull policy arguments from command line and run.
    // See createPolicy for possible options, i.e.:
    // npm myscript.js --dropletName='drippy' --dropletId='1234'
    // where myscript.js simply calls runPolicyCmd()
    const runPolicyCmd = () => {
        // Required fields
        const dropletName = parseOrThrowField('dropletName')
        const dropletId = parseOrThrowField('dropletId')

        const policy = createPolicy(dropletName, dropletId)
        // Optional fields
        policy.timeUnit = parseInt(getCmdArg('timeUnit', policy.timeUnit))
        policy.snapshotKeepCount = parseInt(getCmdArg('snapshotKeepCount', policy.snapshotKeepCount))

        return runPolicy(policy)
    }

    const takeSnapshot = (dropletId, name) => {
        return client.droplets.snapshot(dropletId, name).then(() => {
            console.log(`Took snapshot ${name}`)
        })
    }

    // Take a snapshot from command line
    const takeSnapshotCmd = () => {
        const name = parseOrThrowField('name')
        const dropletId = parseOrThrowField('dropletId')
        return takeSnapshot(dropletId, name)
    }

    // Exposed methods to use for an initialized Backups instance
    return {
        runPolicy,
        runPolicyCmd,
        takeSnapshot,
        takeSnapshotCmd,
    }
}

module.exports = {
    MINUTE,
    HOUR,
    DAY,
    createPolicy,
    Backups,
}
