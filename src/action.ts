import { getInput, debug, info, setOutput } from '@actions/core';
import { context } from '@actions/github';

import { Config } from './config';
import { IssueForm } from './issue-form';
import { Labeler } from './labeler';
import { CustomOctokit } from './octokit';

import { issueFormSchema } from './schema/input';

async function action(octokit: CustomOctokit) {
  const parsedIssueForm = issueFormSchema.safeParse(
    JSON.parse(getInput('issue-form', { required: true }))
  );
  if (!parsedIssueForm.success) {
    throw new Error(
      `Incorrect format of provided 'issue-form' input: ${parsedIssueForm.error.message}`
    );
  }
  const inputIssueNumber = getInput('issue-number', { required: false });
  const issueNumber = inputIssueNumber ? parseInt(inputIssueNumber) : context.issue.number;
  
  const issueForm = new IssueForm(parsedIssueForm.data);
  const config = await Config.getConfig(octokit);

  const labeler = new Labeler(issueForm, config);

  const labels = labeler.gatherLabels();

  setOutput('labels', JSON.stringify(labels ?? []));
  setOutput('policy', JSON.stringify(labeler.outputPolicy));

  // Check if there are some labels to be set
  if (!labels || (Array.isArray(labels) && labels?.length < 1)) {
    info('Nothing to do here. CY@');
    return;
  }

  info(`Labels to be set: ${labels}`);
  info(`Used policy: ${JSON.stringify(labeler.outputPolicy, null, 2)}`);
  info(`Target issue: ${issueNumber}`);

  const response = await octokit.request(
    'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
    {
      ...context.repo,
      issue_number: issueNumber,
      labels,
    }
  );

  debug(`GitHub API response status: [${response.status}]`);
}

export default action;
