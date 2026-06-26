import type { StorySection } from '../types';

const normalizeForCompare = (sections: StorySection[]) =>
    [...sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
            heading: section.heading.trim(),
            body: section.body.trim(),
        }));

/** True when editor sections differ from the last published snapshot. */
export function storySectionsDiffer(a: StorySection[], b: StorySection[]): boolean {
    return JSON.stringify(normalizeForCompare(a)) !== JSON.stringify(normalizeForCompare(b));
}
