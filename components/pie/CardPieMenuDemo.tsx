import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { PieMenu, PieMenuItem } from './PieMenu';
import { Card, CardContent } from './ui/card';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music,
  Folder,
  File,
  Edit,
  Copy,
  Share,
  Trash2,
  Download,
  Star,
  Eye,
  MoreHorizontal,
  Move,
  Lock,
  Tag,
  Info,
  Archive
} from 'lucide-react';
import { Badge } from './ui/badge';

interface CardItem {
  id: string;
  title: string;
  type: 'document' | 'image' | 'video' | 'audio' | 'folder' | 'file';
  icon: typeof FileText;
  color: string;
  subtitle: string;
}

const cardItems: CardItem[] = [
  { id: '1', title: 'Project Proposal', type: 'document', icon: FileText, color: 'bg-blue-100', subtitle: '2.4 MB • PDF' },
  { id: '2', title: 'Design Assets', type: 'folder', icon: Folder, color: 'bg-yellow-100', subtitle: '24 items' },
  { id: '3', title: 'Vacation Photo', type: 'image', icon: ImageIcon, color: 'bg-green-100', subtitle: '4.8 MB • JPG' },
  { id: '4', title: 'Tutorial Video', type: 'video', icon: Video, color: 'bg-purple-100', subtitle: '142 MB • MP4' },
  { id: '5', title: 'Podcast Episode', type: 'audio', icon: Music, color: 'bg-pink-100', subtitle: '28 MB • MP3' },
  { id: '6', title: 'Meeting Notes', type: 'document', icon: FileText, color: 'bg-indigo-100', subtitle: '124 KB • DOC' },
  { id: '7', title: 'Screenshots', type: 'folder', icon: Folder, color: 'bg-orange-100', subtitle: '12 items' },
  { id: '8', title: 'Contract.pdf', type: 'file', icon: File, color: 'bg-teal-100', subtitle: '896 KB • PDF' },
  { id: '9', title: 'Logo Design', type: 'image', icon: ImageIcon, color: 'bg-red-100', subtitle: '1.2 MB • PNG' },
  { id: '10', title: 'Background Music', type: 'audio', icon: Music, color: 'bg-cyan-100', subtitle: '6.4 MB • WAV' },
  { id: '11', title: 'Presentation', type: 'document', icon: FileText, color: 'bg-lime-100', subtitle: '8.2 MB • PPTX' },
  { id: '12', title: 'Demo Reel', type: 'video', icon: Video, color: 'bg-fuchsia-100', subtitle: '256 MB • MOV' }
];

const createCardMenu = (cardTitle: string): PieMenuItem[] => [
  {
    id: 'view',
    icon: Eye,
    label: 'View',
    onClick: () => console.log(`Viewing ${cardTitle}`)
  },
  {
    id: 'edit',
    icon: Edit,
    label: 'Edit',
    onClick: () => console.log(`Editing ${cardTitle}`)
  },
  {
    id: 'copy',
    icon: Copy,
    label: 'Copy',
    onClick: () => console.log(`Copied ${cardTitle}`)
  },
  {
    id: 'share',
    icon: Share,
    label: 'Share',
    onClick: () => console.log(`Sharing ${cardTitle}`)
  },
  {
    id: 'star',
    icon: Star,
    label: 'Favorite',
    onClick: () => console.log(`Added ${cardTitle} to favorites`)
  },
  {
    id: 'download',
    icon: Download,
    label: 'Download',
    onClick: () => console.log(`Downloading ${cardTitle}`)
  },
  {
    id: 'more',
    icon: MoreHorizontal,
    label: 'More',
    submenu: [
      {
        id: 'move',
        icon: Move,
        label: 'Move',
        onClick: () => console.log(`Moving ${cardTitle}`)
      },
      {
        id: 'lock',
        icon: Lock,
        label: 'Lock',
        onClick: () => console.log(`Locked ${cardTitle}`)
      },
      {
        id: 'tag-file',
        icon: Tag,
        label: 'Add Tags',
        onClick: () => console.log(`Adding tags to ${cardTitle}`)
      },
      {
        id: 'info',
        icon: Info,
        label: 'Info',
        onClick: () => console.log(`Showing info for ${cardTitle}`)
      },
      {
        id: 'archive',
        icon: Archive,
        label: 'Archive',
        onClick: () => console.log(`Archived ${cardTitle}`)
      }
    ]
  },
  {
    id: 'delete',
    icon: Trash2,
    label: 'Delete',
    onClick: () => console.log(`Deleted ${cardTitle}`)
  }
];

export function CardPieMenuDemo() {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [currentMenu, setCurrentMenu] = useState<PieMenuItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCardClick = (e: React.MouseEvent, card: CardItem) => {
    e.stopPropagation();
    
    const cardElement = e.currentTarget as HTMLElement;
    const cardRect = cardElement.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    
    if (containerRect) {
      // Calculate the center of the card relative to the container
      const centerX = cardRect.left + cardRect.width / 2 - containerRect.left;
      const centerY = cardRect.top + cardRect.height / 2 - containerRect.top;
      
      setMenuPosition({ x: centerX, y: centerY });
      setCurrentMenu(createCardMenu(card.title));
      setSelectedCard(card.id);
    }
  };

  const handleClose = () => {
    setSelectedCard(null);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-white text-2xl">Card Selection Menu</h3>
        <p className="text-blue-200">
          Click any card to open a pie menu centered on the card. Click the "More" option to open a submenu with additional actions.
        </p>
        <Badge variant="outline" className="border-blue-300/50 text-blue-200">
          {cardItems.length} cards available • Submenu enabled
        </Badge>
      </div>

      <div 
        ref={containerRef}
        className="relative bg-white/5 backdrop-blur-md border border-white/20 rounded-lg p-6"
        onClick={handleClose}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cardItems.map((card) => (
            <motion.div
              key={card.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Card 
                className={`cursor-pointer transition-all ${
                  selectedCard === card.id 
                    ? 'ring-2 ring-blue-400 bg-white/20' 
                    : 'bg-white/10 hover:bg-white/15'
                } backdrop-blur-sm border-white/20`}
                onClick={(e) => handleCardClick(e, card)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className={`${card.color} rounded-lg p-4 flex items-center justify-center`}>
                    <card.icon className="text-gray-700" size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-white text-sm truncate">{card.title}</p>
                    <p className="text-blue-200 text-xs">{card.subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Pie Menu */}
        <PieMenu
          items={currentMenu}
          isOpen={selectedCard !== null}
          position={menuPosition}
          onClose={handleClose}
          radius={100}
          centerRadius={35}
        />
      </div>

      <div className="bg-white/5 backdrop-blur-md border border-white/20 rounded-lg p-4">
        <p className="text-blue-200 text-sm">
          💡 <strong>Tip:</strong> The pie menu emerges from the center of each card with 8 quick actions. 
          Click "More" (marked with →) to access a submenu with 5 additional options. Click the back button or press Escape to navigate back.
        </p>
      </div>
    </div>
  );
}
