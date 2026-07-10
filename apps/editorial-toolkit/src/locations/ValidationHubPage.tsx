import { useCallback, useEffect, useState } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import type { PageAppSDK } from "@contentful/app-sdk";
import {
  Badge,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Note,
  Paragraph,
  Spinner,
  Subheading,
  Table,
  Text,
} from "@contentful/f36-components";

import {
  snapshotFromCma,
  findDuplicateSlugs,
  findStaleDrafts,
  findMissingFields,
  findBrokenRelated,
  type EntrySnapshot,
  type DuplicateSlugRow,
  type MissingFieldsRow,
  type BrokenRelatedRow,
} from "../utils/audit";

const CONTENT_TYPE_ID = "blogPost";
const PAGE_SIZE = 100;
const STALE_DAYS = 14;

/**
 * Validation Hub — one page, every editorial QA check.
 *
 * Generalised from the source platform's validation hub: instead of one page
 * per validator, a single page-location app runs all checks over the space and
 * lets editors jump straight to the offending entries. The checks themselves
 * are pure functions (src/utils/audit.ts) shared with unit tests and mirroring
 * the scheduled GitHub-Actions audit.
 */
export function ValidationHubPage() {
  const sdk = useSDK<PageAppSDK>();
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [ran, setRan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [duplicates, setDuplicates] = useState<DuplicateSlugRow[]>([]);
  const [staleDrafts, setStaleDrafts] = useState<EntrySnapshot[]>([]);
  const [missingFields, setMissingFields] = useState<MissingFieldsRow[]>([]);
  const [brokenRelated, setBrokenRelated] = useState<BrokenRelatedRow[]>([]);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setScanned(0);

    const snapshots: EntrySnapshot[] = [];
    let skip = 0;
    let total = Infinity;

    try {
      while (skip < total) {
        const resp = await sdk.cma.entry.getMany({
          query: { content_type: CONTENT_TYPE_ID, limit: PAGE_SIZE, skip },
        });
        total = resp.total;
        for (const item of resp.items) {
          snapshots.push(snapshotFromCma(item as never));
        }
        skip += resp.items.length;
        setScanned(skip);
        if (resp.items.length === 0) break;
      }

      setDuplicates(findDuplicateSlugs(snapshots));
      setStaleDrafts(findStaleDrafts(snapshots, new Date(), STALE_DAYS));
      setMissingFields(findMissingFields(snapshots));
      setBrokenRelated(findBrokenRelated(snapshots));
      setRan(true);
    } catch {
      setError("Scan failed — check the app's CMA permissions.");
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const openEntry = (id: string) => sdk.navigator.openEntry(id, { slideIn: true });

  const summary: { label: string; count: number; blocking: boolean }[] = [
    { label: "Duplicate slugs", count: duplicates.length, blocking: true },
    { label: "Broken related links", count: brokenRelated.length, blocking: true },
    { label: "Missing fields", count: missingFields.length, blocking: false },
    { label: `Stale drafts (>${STALE_DAYS}d)`, count: staleDrafts.length, blocking: false },
  ];
  const totalIssues = summary.reduce((n, s) => n + s.count, 0);

  return (
    <Flex flexDirection="column" gap="spacingL" style={{ maxWidth: 960, margin: "40px auto", padding: "0 24px" }}>
      <Flex justifyContent="space-between" alignItems="center">
        <Heading marginBottom="none">Validation Hub</Heading>
        <Button variant="primary" onClick={() => void scan()} isLoading={loading}>
          Re-scan
        </Button>
      </Flex>

      <Paragraph marginBottom="none">
        Every editorial QA check over all <Text fontWeight="fontWeightDemiBold">blogPost</Text> entries:
        duplicate slugs, links to deleted posts, incomplete metadata and forgotten drafts. Click an entry
        to open it.
      </Paragraph>

      {loading && (
        <Flex alignItems="center" gap="spacingS">
          <Spinner />
          <Text fontColor="gray600">Scanned {scanned} entries…</Text>
        </Flex>
      )}

      {error && <Note variant="negative">{error}</Note>}

      {ran && !error && (
        <Grid columns="1fr 1fr 1fr 1fr" columnGap="spacingM">
          {summary.map((s) => (
            <Card key={s.label} padding="default">
              <Flex flexDirection="column" gap="spacing2Xs">
                <Text fontSize="fontSize2Xl" fontWeight="fontWeightDemiBold">
                  {s.count}
                </Text>
                <Text fontColor="gray600" fontSize="fontSizeS">
                  {s.label}
                </Text>
                <Badge variant={s.count === 0 ? "positive" : s.blocking ? "negative" : "warning"}>
                  {s.count === 0 ? "clean" : s.blocking ? "blocking" : "review"}
                </Badge>
              </Flex>
            </Card>
          ))}
        </Grid>
      )}

      {ran && !error && totalIssues === 0 && (
        <Note variant="positive">All {scanned} entries pass every check. 🎉</Note>
      )}

      {duplicates.length > 0 && (
        <Flex flexDirection="column" gap="spacingS">
          <Subheading marginBottom="none">Duplicate slugs</Subheading>
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Cell>Slug</Table.Cell>
                <Table.Cell>Count</Table.Cell>
                <Table.Cell>Entries</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {duplicates.map((row) => (
                <Table.Row key={row.slug}>
                  <Table.Cell>
                    <Text fontWeight="fontWeightDemiBold">{row.slug}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="negative">{row.entries.length}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex flexDirection="column" gap="spacing2Xs">
                      {row.entries.map((e) => (
                        <Button
                          key={e.id}
                          variant="transparent"
                          size="small"
                          onClick={() => openEntry(e.id)}
                          style={{ justifyContent: "flex-start" }}
                        >
                          {e.title}
                        </Button>
                      ))}
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Flex>
      )}

      {brokenRelated.length > 0 && (
        <Flex flexDirection="column" gap="spacingS">
          <Subheading marginBottom="none">Broken related links</Subheading>
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Cell>Entry</Table.Cell>
                <Table.Cell>Dead links</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {brokenRelated.map((row) => (
                <Table.Row key={row.entry.id}>
                  <Table.Cell>
                    <Button
                      variant="transparent"
                      size="small"
                      onClick={() => openEntry(row.entry.id)}
                      style={{ justifyContent: "flex-start" }}
                    >
                      {row.entry.title}
                    </Button>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontColor="gray600">{row.missingIds.join(", ")}</Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Flex>
      )}

      {missingFields.length > 0 && (
        <Flex flexDirection="column" gap="spacingS">
          <Subheading marginBottom="none">Missing fields</Subheading>
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Cell>Entry</Table.Cell>
                <Table.Cell>Missing</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {missingFields.map((row) => (
                <Table.Row key={row.entry.id}>
                  <Table.Cell>
                    <Button
                      variant="transparent"
                      size="small"
                      onClick={() => openEntry(row.entry.id)}
                      style={{ justifyContent: "flex-start" }}
                    >
                      {row.entry.title}
                    </Button>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap="spacing2Xs" flexWrap="wrap">
                      {row.missing.map((m) => (
                        <Badge key={m} variant="warning">
                          {m}
                        </Badge>
                      ))}
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Flex>
      )}

      {staleDrafts.length > 0 && (
        <Flex flexDirection="column" gap="spacingS">
          <Subheading marginBottom="none">Stale drafts</Subheading>
          <Table>
            <Table.Head>
              <Table.Row>
                <Table.Cell>Entry</Table.Cell>
                <Table.Cell>Last touched</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {staleDrafts.map((e) => (
                <Table.Row key={e.id}>
                  <Table.Cell>
                    <Button
                      variant="transparent"
                      size="small"
                      onClick={() => openEntry(e.id)}
                      style={{ justifyContent: "flex-start" }}
                    >
                      {e.title}
                    </Button>
                  </Table.Cell>
                  <Table.Cell>
                    <Text fontColor="gray600">{new Date(e.updatedAt).toLocaleDateString()}</Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Flex>
      )}
    </Flex>
  );
}
