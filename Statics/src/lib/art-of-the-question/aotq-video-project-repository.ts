import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, getTable } from "@/lib/dynamodb";
import type { VideoProject, VideoProjectAskTurn, VideoProjectSource } from "@/lib/art-of-the-question/video-project-types";

const TABLE = () => getTable("aotq");

const PK_PROJECT = (id: string) => `VIDEO_PROJECT#${id}`;
const SK_META = "META";
const PK_USER = (u: string) => `USER#${u}`;
const skUserProject = (projectId: string) => `VIDEO_PROJECT#${projectId}`;
const skSource = (sourceId: string) => `SOURCE#${sourceId}`;
const skAsk = (askId: string) => `ASK#${askId}`;

type Entity = "video_project_meta" | "video_project_index" | "video_project_source" | "video_project_ask";

function stripKeys<T extends Record<string, unknown>>(raw: T): T {
  const { pk, sk, entity, ...rest } = raw;
  return rest as T;
}

export function getAotqVideoProjectRepository() {
  return {
    async putProject(project: VideoProject): Promise<void> {
      const now = project.updatedAt;
      await docClient.send(
        new PutCommand({
          TableName: TABLE(),
          Item: {
            ...project,
            pk: PK_PROJECT(project.projectId),
            sk: SK_META,
            entity: "video_project_meta" satisfies Entity,
          },
        })
      );
      await docClient.send(
        new PutCommand({
          TableName: TABLE(),
          Item: {
            pk: PK_USER(project.userId),
            sk: skUserProject(project.projectId),
            entity: "video_project_index" satisfies Entity,
            projectId: project.projectId,
            name: project.name,
            updatedAt: now,
          },
        })
      );
    },

    async getProject(projectId: string): Promise<VideoProject | null> {
      const { Item } = await docClient.send(
        new GetCommand({ TableName: TABLE(), Key: { pk: PK_PROJECT(projectId), sk: SK_META } })
      );
      if (!Item || Item.entity !== "video_project_meta") return null;
      return stripKeys(Item as Record<string, unknown>) as unknown as VideoProject;
    },

    async listProjectsForUser(userId: string): Promise<VideoProject[]> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: TABLE(),
          KeyConditionExpression: "pk = :p AND begins_with(sk, :vp)",
          ExpressionAttributeValues: { ":p": PK_USER(userId), ":vp": "VIDEO_PROJECT#" },
        })
      );
      const out: VideoProject[] = [];
      for (const raw of Items ?? []) {
        if (raw.entity !== "video_project_index") continue;
        const meta = await this.getProject(String(raw.projectId));
        if (meta) out.push(meta);
      }
      out.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      return out;
    },

    async deleteProject(projectId: string, userId: string): Promise<void> {
      const sources = await this.listSources(projectId);
      for (const s of sources) {
        await docClient.send(
          new DeleteCommand({
            TableName: TABLE(),
            Key: { pk: PK_PROJECT(projectId), sk: skSource(s.sourceId) },
          })
        );
      }
      await this.deleteAllAskTurnsForProject(projectId);
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE(),
          Key: { pk: PK_PROJECT(projectId), sk: SK_META },
        })
      );
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE(),
          Key: { pk: PK_USER(userId), sk: skUserProject(projectId) },
        })
      );
    },

    async putSource(row: VideoProjectSource): Promise<void> {
      await docClient.send(
        new PutCommand({
          TableName: TABLE(),
          Item: {
            ...row,
            pk: PK_PROJECT(row.projectId),
            sk: skSource(row.sourceId),
            entity: "video_project_source" satisfies Entity,
          },
        })
      );
      const proj = await this.getProject(row.projectId);
      if (proj) {
        await this.putProject({ ...proj, updatedAt: row.updatedAt });
      }
    },

    async getSource(projectId: string, sourceId: string): Promise<VideoProjectSource | null> {
      const { Item } = await docClient.send(
        new GetCommand({
          TableName: TABLE(),
          Key: { pk: PK_PROJECT(projectId), sk: skSource(sourceId) },
        })
      );
      if (!Item || Item.entity !== "video_project_source") return null;
      return stripKeys(Item as Record<string, unknown>) as unknown as VideoProjectSource;
    },

    /** Count SOURCE# rows for a project (paginates if needed). */
    async countSources(projectId: string): Promise<number> {
      let total = 0;
      let exclusiveStartKey: Record<string, unknown> | undefined;
      for (;;) {
        const { Count, LastEvaluatedKey } = await docClient.send(
          new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: "pk = :p AND begins_with(sk, :s)",
            ExpressionAttributeValues: { ":p": PK_PROJECT(projectId), ":s": "SOURCE#" },
            Select: "COUNT",
            ExclusiveStartKey: exclusiveStartKey,
          })
        );
        total += Count ?? 0;
        if (!LastEvaluatedKey) break;
        exclusiveStartKey = LastEvaluatedKey as Record<string, unknown>;
      }
      return total;
    },

    async listSources(projectId: string): Promise<VideoProjectSource[]> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: TABLE(),
          KeyConditionExpression: "pk = :p AND begins_with(sk, :s)",
          ExpressionAttributeValues: { ":p": PK_PROJECT(projectId), ":s": "SOURCE#" },
        })
      );
      const rows: VideoProjectSource[] = [];
      for (const raw of Items ?? []) {
        if (raw.entity !== "video_project_source") continue;
        rows.push(stripKeys(raw as Record<string, unknown>) as unknown as VideoProjectSource);
      }
      rows.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
      return rows;
    },

    async deleteSource(projectId: string, sourceId: string): Promise<void> {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE(),
          Key: { pk: PK_PROJECT(projectId), sk: skSource(sourceId) },
        })
      );
      const proj = await this.getProject(projectId);
      if (proj) {
        await this.putProject({ ...proj, updatedAt: new Date().toISOString() });
      }
    },

    async putAskTurn(row: VideoProjectAskTurn): Promise<void> {
      await docClient.send(
        new PutCommand({
          TableName: TABLE(),
          Item: {
            ...row,
            pk: PK_PROJECT(row.projectId),
            sk: skAsk(row.askId),
            entity: "video_project_ask" satisfies Entity,
          },
        })
      );
    },

    async listAskTurns(projectId: string, limit = 40): Promise<VideoProjectAskTurn[]> {
      const { Items } = await docClient.send(
        new QueryCommand({
          TableName: TABLE(),
          KeyConditionExpression: "pk = :p AND begins_with(sk, :a)",
          ExpressionAttributeValues: { ":p": PK_PROJECT(projectId), ":a": "ASK#" },
          Limit: limit,
        })
      );
      const rows: VideoProjectAskTurn[] = [];
      for (const raw of Items ?? []) {
        if (raw.entity !== "video_project_ask") continue;
        rows.push(stripKeys(raw as Record<string, unknown>) as unknown as VideoProjectAskTurn);
      }
      rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      return rows;
    },

    /** Remove every Q&A turn for the project (e.g. after a source is deleted — corpus no longer matches). */
    async deleteAllAskTurnsForProject(projectId: string): Promise<void> {
      let exclusiveStartKey: Record<string, unknown> | undefined;
      for (;;) {
        const { Items, LastEvaluatedKey } = await docClient.send(
          new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: "pk = :p AND begins_with(sk, :a)",
            ExpressionAttributeValues: { ":p": PK_PROJECT(projectId), ":a": "ASK#" },
            ExclusiveStartKey: exclusiveStartKey,
          })
        );
        for (const raw of Items ?? []) {
          if (raw.entity !== "video_project_ask") continue;
          const pk = raw.pk as string;
          const sk = raw.sk as string;
          await docClient.send(
            new DeleteCommand({
              TableName: TABLE(),
              Key: { pk, sk },
            })
          );
        }
        if (!LastEvaluatedKey) break;
        exclusiveStartKey = LastEvaluatedKey as Record<string, unknown>;
      }
    },
  };
}
