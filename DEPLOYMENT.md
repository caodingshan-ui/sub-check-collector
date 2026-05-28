# GitHub Actions deployment

This repository runs `sinspired/sub-check-collector` on GitHub Actions and publishes a plain URL list for Sub-Store.

## Output

- `output/collector-sub-urls.txt`: one subscription URL per line, intended for Sub-Store remote subscription input.
- `output/subscriptions.md`: verbose report from the collector.

## Sub-Store usage

Create one remote subscription in Sub-Store:

```text
Name: collector
URL: https://raw.githubusercontent.com/<owner>/<repo>/main/output/collector-sub-urls.txt
```

For this server, Sub-Store base path is:

```text
https://subs.puyuan.eu.cc/MfbpV8IlEJkFsUDAVzaf
```

After creating the subscription, copy the output link from Sub-Store UI. It will usually look like one of:

```text
https://subs.puyuan.eu.cc/MfbpV8IlEJkFsUDAVzaf/download/collector
https://subs.puyuan.eu.cc/MfbpV8IlEJkFsUDAVzaf/api/file/collector
```

Use the copied Sub-Store output URL on other servers.

## Config knobs

The workflow supports repository variables:

- `SEARCH_KEYWORDS` default: `free,v2ray,clash,sub,subscription`
- `MAX_REPOSITORIES` default: `80`
- `MIN_STARS` default: `3`
- `MAX_DAYS_SINCE_UPDATE` default: `60`
- `VALIDATE_LINKS` default: `true`
- `LINK_VALIDATION_TIMEOUT` default: `8000`
- `LINK_VALIDATION_CONCURRENCY` default: `8`
- `EXPORT_MAX_URLS` default: `500`

Optional secret:

- `COLLECTOR_GITHUB_TOKEN`: PAT for GitHub search/readme API. If absent, the workflow uses the built-in `GITHUB_TOKEN`.

## Schedule

Runs every 3 days at 03:25 UTC and can be manually triggered via Actions → collect subscription urls → Run workflow.
