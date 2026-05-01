import { AotqVideoProjectDetailPage } from "@art-of-the-question/components/AotqVideoProjectDetailPage";

export default async function ArtOfTheQuestionVideoProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <AotqVideoProjectDetailPage projectId={projectId} />;
}
