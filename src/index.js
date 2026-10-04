import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { run } from './action.js';

await run({ core, context, getOctokit });
