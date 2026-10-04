export const DEMO_REVISION = 'A';
export const DEFAULT_BODY = 'Thanks for the pull request!';

export async function run({ core, context, getOctokit }) {
  try {
    core.setOutput('demo-revision', DEMO_REVISION);
    core.info(`pr-note demo-revision: ${DEMO_REVISION}`);
    if (context.eventName !== 'issue_comment' || context.payload.action !== 'created') {
      core.info('Skipping: only newly created issue comments are handled.');
      return;
    }
    const { issue, comment, sender } = context.payload;
    if (!issue?.pull_request) {
      core.info('Skipping: comment is not on a pull request.');
      return;
    }
    if (!Number.isSafeInteger(issue.number) || issue.number <= 0 ||
        !comment?.user?.login || !comment.user.type) {
      core.setFailed('Malformed pull request comment event.');
      return;
    }
    if (comment.user.type === 'Bot' || comment.user.login.endsWith('[bot]') ||
        sender?.type === 'Bot') {
      core.info('Skipping bot comment to prevent reply loops.');
      return;
    }
    const token = core.getInput('token', { required: true });
    core.setSecret(token);
    const body = core.getInput('body') || DEFAULT_BODY;
    await getOctokit(token).rest.issues.createComment({
      ...context.repo,
      issue_number: issue.number,
      body,
    });
    core.info('Pull request note posted.');
  } catch (error) {
    // API errors may contain request headers or reflected input; never print them.
    const status = Number.isInteger(error?.status) ? ` (HTTP ${error.status})` : '';
    core.setFailed(`Unable to post pull request note${status}. Check event, token permissions, and API availability.`);
  }
}
