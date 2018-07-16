# digitalocean-backups

A small utility to customize backup policies in DigitalOcean

## Installation

Be sure to have Node.js version >= 8 and npm installed.  Then clone this repository:

```
git clone https://github.com/gittyeric/digitalocean-backups.git
```

Now navigate into the directory and install:

```
cd digitalocean-backups/
npm install
```

Then get your (Digitalocean API)[''] token ready.

Now you can run the cmd.js script on a regular basis (such as with crontab) to enforce a backup policy on DO:
DO NOT run this more than the snapshot timeUnit interval or you may get unexpected results!

## Command line Usage

This is mostly intended for command line usage, so your script can simply call the runPolicyCmd command while passing in the required parameters, example:

```
node dist/backup.js --token="myDOApiToken" --dropletId="123" --dropletName="drippy"
```

You an also just take a named snapshot without any policy:
```
node dist/snapshot.js --token="myDOApiToken" --dropletId="123" --name="pre-git-checkpoint"
```

## Javascript Usage

Use the createPolicy function to define your policy instead of through command line, and pass your token into the Backups function when initializating:

```
import { Backups, HOUR, createPolicy } from "index";
// Create a policy of hourly backups and store last 48 hours-worth
const myPolicy = createPolicy("drippy", "123", 48, HOUR)
Backups("myToken").runPolicy(myPolicy); // returns a promise that completes
                                        // after creation and deletions finish
```

There's also takeSnapshot(dropletId, snapshotName) which returns a promise.

## Crontab

For daily 2am snapshots, use something like:

```
0 2 * * * node path/to/project/dist/backup.js --token="myDOApiToken" --dropletId="123" --dropletName="drippy" >> /var/log/do-backup.log
```