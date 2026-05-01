import { AotqQuestionPage } from "@art-of-the-question/components/AotqQuestionPage";

export default async function ArtOfTheQuestionQuestionPage({
  params,
}: {
  params: Promise<{ interviewId: string; questionId: string }>;
}) {
  const { interviewId, questionId } = await params;
  return <AotqQuestionPage interviewId={interviewId} questionId={questionId} />;
}
