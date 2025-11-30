'use client';

import { BasicBlocksKit } from './basic-blocks-kit';
import { BasicMarksKit } from './basic-marks-kit';
import { BlockMenuKit } from './block-menu-kit';
import { DndKit } from './dnd-kit';

export const BasicNodesKit = [
  ...DndKit,
  ...BlockMenuKit,
  ...BasicBlocksKit,
  ...BasicMarksKit,
];
