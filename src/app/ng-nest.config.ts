import { XConfig } from '@ng-nest/ui/core';

export const NgNestConfig: XConfig = {
  components: {
    icon: {
      href: './assets/ng-nest-icons/'
    },
    pagination: {
      space: '0.8rem'
    },
    table: {
      rowHeight: 38
    },
    dialog: {
      width: '40rem'
    },
    switch: {
      size: 'small'
    },
    popover: {
      minWidth: '1rem'
    }
  },
  theme: {
    colors: { primary: '#4096ff' },
    vars: {
      borderRadius: '0.5rem',
      borderSmallRadius: '0.25rem'
    }
  }
};
