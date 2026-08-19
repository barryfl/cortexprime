export default {
  0: {
    defaultImage: 'icons/svg/mystery-man.svg',
    hasAssets: true,
    hasComplications: true,
    hasHidableTraits: false,
    hasNotesPage: true,
    hasPlotPoints: true,
    id: '_1',
    name: 'Character',
    sectionTabs: {
      profile: '_tab1',
      plotPoints: '_tab1',
      assets: '_tab1',
      complications: '_tab1'
    },
    sectionLayout: {
      profile: { order: 0, tabId: '_tab1', width: 'full' },
      plotPoints: { order: 1, tabId: '_tab1', width: 'full' },
      _11: { order: 2, tabId: '_tab1', width: 'full' },
      _12: { order: 3, tabId: '_tab1', width: 'full' },
      assets: { order: 4, tabId: '_tab1', width: 'full' },
      complications: { order: 5, tabId: '_tab1', width: 'full' }
    },
    showProfileImage: true,
    tabs: {
      0: {
        id: '_tab1',
        label: 'Traits'
      }
    },
    traitSets: {
      0: {
        description: null,
        hasDescription: false,
        id: '_11',
        label: 'Distinctions',
        tabId: '_tab1',
        shutdown: false,
        traits: {
          0: {
            dice: {
              value: {
                0: '8'
              }
            },
            id: '_111',
            label: '',
            name: 'Distinction 1',
            valueType: 'die',
            sfx: {
              0: {
                label: 'Hinder',
                description: 'Gain a PP when you switch out this distinction\'s d8 for a d4.',
                unlocked: true
              }
            },
            shutdown: false
          },
          1: {
            dice: {
              value: {
                0: '8'
              }
            },
            id: '_112',
            label: '',
            name: 'Distinction 2',
            valueType: 'die',
            sfx: {
              0: {
                label: 'Hinder',
                description: 'Gain a PP when you switch out this distinction\'s d8 for a d4.',
                unlocked: true
              }
            },
            shutdown: false
          },
          2: {
            dice: {
              value: {
                0: '8'
              }
            },
            id: '_113',
            label: '',
            name: 'Distinction 3',
            valueType: 'die',
            sfx: {
              0: {
                label: 'Hinder',
                description: 'Gain a PP when you switch out this distinction\'s d8 for a d4.',
                unlocked: true
              }
            },
            shutdown: false
          }
        },
        settings: {
          hasDescription: false,
          hasDescriptors: false,
          hasDice: true,
          hasLabel: true,
          hasSfx: true,
          hasSubTraits: false,
          subTraitsHaveDice: true,
          subTraitsDiceConsumable: false,
        }
      },
      1: {
        description: null,
        hasDescription: false,
        id: '_12',
        label: 'Signature Assets',
        tabId: '_tab1',
        shutdown: false,
        settings: {
          hasDescription: false,
          hasDescriptors: false,
          hasDice: true,
          hasLabel: false,
          hasSfx: true,
          hasSubTraits: false,
          subTraitsHaveDice: false,
          subTraitsDiceConsumable: false,
        },
        traits: {}
      }
    }
  },
  1: {
    defaultImage: 'icons/svg/house.svg',
    hasAssets: true,
    hasComplications: true,
    hasHidableTraits: true,
    hasNotesPage: true,
    hasPlotPoints: true,
    id: '_2',
    name: 'Scene',
    sectionTabs: {
      profile: '_tab2',
      plotPoints: '_tab2',
      assets: '_tab2',
      complications: '_tab2'
    },
    sectionLayout: {
      profile: { order: 0, tabId: '_tab2', width: 'full' },
      plotPoints: { order: 1, tabId: '_tab2', width: 'full' },
      _25: { order: 2, tabId: '_tab2', width: 'full' },
      _21: { order: 3, tabId: '_tab2', width: 'full' },
      _22: { order: 4, tabId: '_tab2', width: 'full' },
      _23: { order: 5, tabId: '_tab2', width: 'full' },
      _24: { order: 6, tabId: '_tab2', width: 'full' },
      assets: { order: 7, tabId: '_tab2', width: 'full' },
      complications: { order: 8, tabId: '_tab2', width: 'full' }
    },
    showProfileImage: false,
    tabs: {
      0: {
        id: '_tab2',
        label: 'Traits'
      }
    },
    traitSets: {
      0: {
        description: null,
        hasDescription: false,
        id: '_21',
        label: 'Extras',
        tabId: '_tab2',
        shutdown: false,
        traits: {},
        settings: {
          hasDescription: false,
          hasDescriptors: false,
          hasDice: true,
          hasLabel: false,
          hasSfx: false,
          hasSubTraits: false,
          subTraitsHaveDice: true,
          subTraitsDiceConsumable: false
        }
      },
      1: {
        description: null,
        hasDescription: false,
        id: '_22',
        label: 'Minor GMCs',
        tabId: '_tab2',
        shutdown: false,
        traits: {},
        settings: {
          hasDescription: true,
          hasDescriptors: false,
          hasDice: false,
          hasLabel: false,
          hasSfx: false,
          hasSubTraits: true,
          subTraitsHaveDice: true,
          subTraitsDiceConsumable: false
        }
      },
      2: {
        description: null,
        hasDescription: false,
        id: '_23',
        label: 'Mobs',
        tabId: '_tab2',
        shutdown: false,
        traits: {},
        settings: {
          hasDescription: true,
          hasDescriptors: false,
          hasDice: true,
          hasLabel: true,
          hasSfx: false,
          hasSubTraits: true,
          subTraitsHaveDice: true,
          subTraitsDiceConsumable: false
        }
      },
      3: {
        description: null,
        hasDescription: false,
        id: '_24',
        label: 'Bosses/Factions/Orgs',
        tabId: '_tab2',
        shutdown: false,
        traits: {},
        settings: {
          hasDescription: true,
          hasDescriptors: false,
          hasDice: true,
          hasLabel: true,
          hasSfx: true,
          hasSubTraits: true,
          subTraitsHaveDice: true,
          subTraitsDiceConsumable: false
        }
      },
      4: {
        description: null,
        hasDescription: false,
        id: '_25',
        label: 'Doom Pool',
        shutdown: false,
        tabId: '_tab2',
        settings: {
          hasDescription: false,
          hasDescriptors: false,
          hasDice: true,
          hasLabel: false,
          hasSfx: false,
          hasSubTraits: false,
          diceConsumable: false,
          subTraitsHaveDice: false,
          subTraitsDiceConsumable: false
        },
        traits: {
          0: {
            dice: { value: { 0: '6', 1: '6' } },
            id: '_251',
            name: 'Doom Pool',
            valueType: 'die'
          }
        }
      }
    }
  }
}
