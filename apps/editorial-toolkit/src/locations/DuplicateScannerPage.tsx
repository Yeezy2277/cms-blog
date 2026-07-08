import { useCallback, useEffect, useState } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import type { PageAppSDK } from "@contentful/app-sdk";
import {
  Badge,
  Button,
  Flex,
  Heading,
  Note,
  Paragraph,
  Spinner,
  Table,
  Text,
} from "@contentful/f36-components";

const CONTENT_TYPE_ID = "blogPost";
const PAGE_SIZE = 100;

type Row = { slug: string; entries: { id: string; title: string }[] };

/**
 * Content QA — duplicate slug scanner.
 *
 * Paginates every blogPost via the CMA, groups by slug and surfaces any slug
 * used by more than one entry (a common cause of broken canonical URLs and ISR
 * collisions). Generalised from the source platform's duplicate-article
 * validator, which scanned curation entries for duplicate references; here it's
 * a space-wide editorial audit run from the app's Page location.
 */
export function DuplicateScannerPage() {
  const sdk = useSDK<PageAppSDK>();
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [duplicates, setDuplicates] = useState<Row[]>([]);
  const [ran, setRan] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleOf = useCallback((fields: Record<string, Record<string, unknown>>): string => {
    const byLocale = fields?.title;
    const value = byLocale ? Object.values(byLocale)[0] : undefined;
    return typeof value === "string" && value ? value : "Untitled";
  }, []);

  const slugOf = useCallback((fields: Record<string, Record<string, unknown>>): string => {
    const byLocale = fields?.slug;
    const value = byLocale ? Object.values(byLocale)[0] : undefined;
    return typeof value === "string" ? value : "";
  }, []);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDuplicates([]);
    setScanned(0);

    const bySlug = new Map<string, { id: string; title: string }[]>();
    let skip = 0;
    let total = Infinity;

    try {
      while (skip < total) {
        const resp = await sdk.cma.entry.getMany({
          query: { content_type: CONTENT_TYPE_ID, limit: PAGE_SIZE, skip },
        });
        total = resp.total;
        for (const item of resp.items) {
          const fields = item.fields as Record<string, Record<string, unknown>>;
          const slug = slugOf(fields);
          if (!slug) continue;
          const list = bySlug.get(slug) ?? [];
          list.push({ id: item.sys.id, title: titleOf(fields) });
          bySlug.set(slug, list);
        }
        skip += resp.items.length;
        setScanned(skip);
        if (resp.items.length === 0) break;
      }

      const rows: Row[] = [];
      for (const [slug, entries] of bySlug) {
        if (entries.length > 1) rows.push({ slug, entries });
      }
      rows.sort((a, b) => b.entries.length - a.entries.length);
      setDuplicates(rows);
      setRan(true);
    } catch {
      setError("Scan failed — check the app's CMA permissions.");
    } finally {
      setLoading(false);
    }
  }, [sdk, slugOf, titleOf]);

  useEffect(() => {
    void scan();
  }, [scan]);

  return (
    <Flex flexDirection="column" gap="spacingL" style={{ maxWidth: 900, margin: "40px auto", padding: "0 24px" }}>
      <Flex justifyContent="space-between" alignItems="center">
        <Heading>Content QA · Duplicate slugs</Heading>
        <Button variant="primary" onClick={() => void scan()} isLoading={loading}>
          Re-scan
        </Button>
      </Flex>

      <Paragraph>
        Scans every <Text fontWeight="fontWeightDemiBold">blogPost</Text> and flags any slug used by more
        than one entry. Duplicate slugs break canonical URLs and static routes.
      </Paragraph>

      {loading && (
        <Flex alignItems="center" gap="spacingS">
          <Spinner />
          <Text fontColor="gray600">Scanned {scanned} entries…</Text>
        </Flex>
      )}

      {error && <Note variant="negative">{error}</Note>}

      {!loading && ran && duplicates.length === 0 && !error && (
        <Note variant="positive">No duplicate slugs found across {scanned} entries. 🎉</Note>
      )}

      {duplicates.length > 0 && (
        <>
          <Note variant="warning">
            {duplicates.length} slug{duplicates.length === 1 ? "" : "s"} used by multiple entries.
          </Note>
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
                    <Badge variant="warning">{row.entries.length}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex flexDirection="column" gap="spacing2Xs">
                      {row.entries.map((e) => (
                        <Button
                          key={e.id}
                          variant="transparent"
                          size="small"
                          onClick={() => sdk.navigator.openEntry(e.id, { slideIn: true })}
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
        </>
      )}
    </Flex>
  );
}
