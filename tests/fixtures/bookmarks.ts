// Made-up bookmarks, shaped like chrome.bookmarks.getTree() output.
type Node = chrome.bookmarks.BookmarkTreeNode;

let nextId = 10;
const page = (title: string, url: string): Node => ({ id: String(nextId++), title, url, syncing: false });
const folder = (title: string, children: Node[]): Node => ({ id: String(nextId++), title, children, syncing: false });

/** Folder structure as nested arrays, so the e2e test can create the same tree in Chromium. */
export const SAMPLE = [
  folder('Dev', [
    folder('CSS', [
      folder('Layout', [
        page('A Complete Guide to Flexbox', 'https://example-css.dev/guides/flexbox'),
        page('Centering in CSS: A Complete Guide', 'https://example-css.dev/centering'),
      ]),
      page('Grid by Example', 'https://grid.example.org/'),
    ]),
    page('Understanding React state', 'https://react-notes.example.com/state'),
  ]),
  folder('Cooking', [
    folder('Recipes', [page('Grandma’s Sunday dinner', 'https://family-food.example.net/sunday')]),
    page('Sourdough starter basics', 'https://bread.example.com/starter'),
  ]),
  folder('Travel', [page('Kyoto in three days', 'https://trips.example.org/kyoto-itinerary')]),
];

export const sampleTree = (): Node[] => [
  {
    id: '0',
    title: '',
    syncing: false,
    children: [
      { id: '1', parentId: '0', title: 'Bookmarks bar', children: SAMPLE, syncing: false },
      { id: '2', parentId: '0', title: 'Other bookmarks', children: [], syncing: false },
    ],
  },
];
