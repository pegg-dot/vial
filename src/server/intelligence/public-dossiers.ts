import { PUBLIC_RESEARCH_TOPICS, fetchPublicTrialIndex, getTopicTrials, type TopicTrials } from "./public-trials";
import { getPublicPublicationIndex, getTopicPublications, type TopicPublications } from "./public-publications";

export type ResearchDossier = {
  key: string;
  label: string;
  trials: TopicTrials;
  publications: TopicPublications;
};

export function findResearchTopic(key: string) {
  return PUBLIC_RESEARCH_TOPICS.find(t => t.key === key) ?? null;
}

export async function getAllPublicDossiers(): Promise<ResearchDossier[]> {
  const [trialIndex, publications] = await Promise.all([
    fetchPublicTrialIndex(),
    getPublicPublicationIndex(),
  ]);
  return PUBLIC_RESEARCH_TOPICS.map((topic, i) => ({
    ...topic,
    trials: trialIndex[i]!,
    publications: publications[i]!,
  }));
}

export async function getPublicDossier(key: string): Promise<ResearchDossier | null> {
  const topic = findResearchTopic(key);
  if (!topic) return null;
  const [trials, publications] = await Promise.all([
    getTopicTrials(topic), getTopicPublications(topic),
  ]);
  return { ...topic, trials, publications };
}
