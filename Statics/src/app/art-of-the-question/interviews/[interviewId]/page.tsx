import { AotqInterviewPage } from "@art-of-the-question/components/AotqInterviewPage";

export default async function ArtOfTheQuestionInterviewPage({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}) {
  const { interviewId } = await params;
  return <AotqInterviewPage interviewId={interviewId} />;
}
