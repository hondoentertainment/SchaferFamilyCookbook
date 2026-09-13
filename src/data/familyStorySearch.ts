/**
 * Searchable Family Story excerpts.
 *
 * Mirrors the built-in HistoryView sections so sitewide search can find
 * people, places, and stories even when the CMS has no published override.
 */
export interface FamilyStorySearchEntry {
    id: string;
    heading: string;
    body: string;
}

export const FAMILY_STORY_SEARCH_ENTRIES: FamilyStorySearchEntry[] = [
    {
        id: 'intro',
        heading: 'Schafer / Oehler Family Food History',
        body: 'As remembered by Julie Joy Schafer Johnson, from stories told by Oliver Schafer and Harriet Oehler Schafer. Prepared for the Schafer Family Cookbook. Our family has been involved in producing and preparing food for centuries.',
    },
    {
        id: 'oehler',
        heading: 'The Oehler Family',
        body: 'The Oehler family came from Bavaria to the United States in the mid-1800s. Oehler means to produce or deal in oil. Gottfried Oehler and Mary ran a general store in Wells, Minnesota. Edward Oehler and Minnie Willmert raised Adelia and Harriet Wilma near Buffalo Lake. Childhood Christmases brought an orange, an apple, peanuts, and hand-knit mittens. Oyster stew was a special Christmas meal. Harriet learned canning, drying, chickens, and eggs on the farm. Sundays meant church, Sunday dinner, and fishing at Lake Preston.',
    },
    {
        id: 'schafer',
        heading: 'The Schafer Family',
        body: 'The Schafer family immigrated from northern Germany and settled near Sherburne, Minnesota. Schafer means shepherd in German. John Daniel JD Schafer and Dora Finke Schafer had eleven children. Oliver was the tenth. They moved to the farm south of Buffalo Lake. Oliver remembered horses Pet and Patty, an orchard of plums and apples, cornmeal mush with sorghum syrup, canning, drying, and baking.',
    },
    {
        id: 'harriet-oliver',
        heading: 'Harriet and Oliver',
        body: 'Harriet and Oliver married in 1935 during the Depression and lived with Minnie and Edward, then with JD and Dora. They raised Angus, Hereford, Charolais cattle and Harriet kept nearly one hundred Leghorns. Collecting eggs, butchering chickens, field corn, oats, soybeans, sorghum, and alfalfa.',
    },
    {
        id: 'legacy',
        heading: 'A Legacy of Food',
        body: 'Harriet was an excellent farm cook. Food was not just nourishment—it was work, tradition, love, and survival. That legacy of food, family, and sharing lives on in this cookbook.',
    },
];
