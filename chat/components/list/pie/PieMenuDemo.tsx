import React from 'react';
import { 
  Palette, 
  Move, 
  Type, 
  Square, 
  Circle, 
  Pen,
  Search,
  Calendar,
  Star,
  Tag,
  Folder,
  Moon,
  Share,
  Copy,
  Trash2,
  Edit,
  Download,
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Settings,
  Zap,
  Target,
  Users,
  Bell,
  Mail,
  FileText,
  Cloud,
  Lock,
  Unlock
} from 'lucide-react';
import { PieMenuItem } from './PieMenu';

export const designToolsMenu: PieMenuItem[] = [
  {
    id: 'select',
    icon: Move,
    label: 'Select',
    onClick: () => console.log('Select tool activated')
  },
  {
    id: 'pen',
    icon: Pen,
    label: 'Pen Tool',
    onClick: () => console.log('Pen tool activated')
  },
  {
    id: 'text',
    icon: Type,
    label: 'Text',
    onClick: () => console.log('Text tool activated')
  },
  {
    id: 'rectangle',
    icon: Square,
    label: 'Rectangle',
    onClick: () => console.log('Rectangle tool activated')
  },
  {
    id: 'circle',
    icon: Circle,
    label: 'Circle',
    onClick: () => console.log('Circle tool activated')
  },
  {
    id: 'color',
    icon: Palette,
    label: 'Color Picker',
    onClick: () => console.log('Color picker opened')
  }
];

export const productivityMenu: PieMenuItem[] = [
  {
    id: 'search',
    icon: Search,
    label: 'Search',
    onClick: () => console.log('Search opened')
  },
  {
    id: 'calendar',
    icon: Calendar,
    label: 'Calendar',
    onClick: () => console.log('Calendar opened')
  },
  {
    id: 'star',
    icon: Star,
    label: 'Favorites',
    onClick: () => console.log('Favorites opened')
  },
  {
    id: 'tag',
    icon: Tag,
    label: 'Tags',
    onClick: () => console.log('Tags opened')
  },
  {
    id: 'folder',
    icon: Folder,
    label: 'Files',
    onClick: () => console.log('Files opened')
  },
  {
    id: 'dark-mode',
    icon: Moon,
    label: 'Dark Mode',
    onClick: () => console.log('Dark mode toggled')
  }
];

export const contextMenu: PieMenuItem[] = [
  {
    id: 'copy',
    icon: Copy,
    label: 'Copy',
    onClick: () => console.log('Copied')
  },
  {
    id: 'edit',
    icon: Edit,
    label: 'Edit',
    onClick: () => console.log('Edit mode')
  },
  {
    id: 'share',
    icon: Share,
    label: 'Share',
    onClick: () => console.log('Share dialog opened')
  },
  {
    id: 'download',
    icon: Download,
    label: 'Download',
    onClick: () => console.log('Download started')
  },
  {
    id: 'delete',
    icon: Trash2,
    label: 'Delete',
    onClick: () => console.log('Deleted')
  }
];

export const socialMenu: PieMenuItem[] = [
  {
    id: 'like',
    icon: Heart,
    label: 'Like',
    onClick: () => console.log('Liked')
  },
  {
    id: 'comment',
    icon: MessageCircle,
    label: 'Comment',
    onClick: () => console.log('Comment opened')
  },
  {
    id: 'bookmark',
    icon: Bookmark,
    label: 'Bookmark',
    onClick: () => console.log('Bookmarked')
  },
  {
    id: 'share-social',
    icon: Share,
    label: 'Share',
    onClick: () => console.log('Share opened')
  },
  {
    id: 'more',
    icon: MoreHorizontal,
    label: 'More',
    submenu: [
      {
        id: 'notifications',
        icon: Bell,
        label: 'Notifications',
        onClick: () => console.log('Notifications opened')
      },
      {
        id: 'messages',
        icon: Mail,
        label: 'Messages',
        onClick: () => console.log('Messages opened')
      },
      {
        id: 'report',
        icon: FileText,
        label: 'Report',
        onClick: () => console.log('Report opened')
      },
      {
        id: 'save',
        icon: Cloud,
        label: 'Save to Cloud',
        onClick: () => console.log('Saved to cloud')
      }
    ]
  }
];

export const quickActionsMenu: PieMenuItem[] = [
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings',
    submenu: [
      {
        id: 'general',
        icon: Settings,
        label: 'General',
        onClick: () => console.log('General settings')
      },
      {
        id: 'privacy',
        icon: Lock,
        label: 'Privacy',
        onClick: () => console.log('Privacy settings')
      },
      {
        id: 'appearance',
        icon: Palette,
        label: 'Appearance',
        onClick: () => console.log('Appearance settings')
      },
      {
        id: 'notifications-settings',
        icon: Bell,
        label: 'Notifications',
        onClick: () => console.log('Notification settings')
      }
    ]
  },
  {
    id: 'shortcuts',
    icon: Zap,
    label: 'Shortcuts',
    onClick: () => console.log('Shortcuts opened')
  },
  {
    id: 'focus',
    icon: Target,
    label: 'Focus Mode',
    onClick: () => console.log('Focus mode activated')
  },
  {
    id: 'collaborate',
    icon: Users,
    label: 'Collaborate',
    onClick: () => console.log('Collaboration started')
  },
  {
    id: 'search-quick',
    icon: Search,
    label: 'Quick Search',
    onClick: () => console.log('Quick search opened')
  },
  {
    id: 'calendar-quick',
    icon: Calendar,
    label: 'Add Event',
    onClick: () => console.log('Add event opened')
  }
];

export const menuConfigs = {
  'Design Tools': designToolsMenu,
  'Productivity': productivityMenu,
  'Context Actions': contextMenu,
  'Social Actions': socialMenu,
  'Quick Actions': quickActionsMenu
};