import { UserDicePool } from './applications/UserDicePool.js'
import { localizer, setCssVars } from './scripts/foundryHelpers.js'
import rollDice from './scripts/rollDice.js'

export default () => {
  Hooks.on('renderDialogV2', (application, element) => {
    const typeSelect = element.querySelector('select[name="type"]')
    if (!typeSelect) return

    const actorDocumentTypes = Object.keys(game.system.documentTypes.Actor ?? {})
    const renderedTypes = [...typeSelect.options].map(option => option.value)
    if (!renderedTypes.length || !renderedTypes.every(type => actorDocumentTypes.includes(type))) return

    const actorTypes = Object.values(game.settings.get('cortexprime', 'actorTypes') ?? {})
    if (!actorTypes.length) return

    const documentType = typeSelect.value || actorDocumentTypes[0] || 'character'
    const documentTypeInput = document.createElement('input')
    documentTypeInput.type = 'hidden'
    documentTypeInput.name = 'type'
    documentTypeInput.value = documentType

    typeSelect.before(documentTypeInput)
    typeSelect.name = 'system.actorType.id'
    typeSelect.replaceChildren(...actorTypes.map(actorType => new Option(
      actorType.name || `[${localizer('NoName')}]`,
      actorType.id
    )))
  })

  Hooks.on('preCreateActor', actor => {
    const selectedActorType = foundry.utils.getProperty(actor._source, 'system.actorType')
    if (!selectedActorType?.id || Object.keys(selectedActorType).length !== 1) return

    const actorType = Object.values(game.settings.get('cortexprime', 'actorTypes') ?? {})
      .find(type => type.id === selectedActorType.id)
    if (!actorType) return

    actor.updateSource({
      img: actorType.defaultImage,
      'system.actorType': foundry.utils.deepClone(actorType),
      'system.pp.value': actorType.hasPlotPoints ? 1 : 0
    })
  })

  Hooks.once('diceSoNiceReady', dice3d => {
    dice3d.addSystem({ id: 'cp-pp', name: 'Cortex Prime Plot Point' }, false)
    const ppLabel = 'systems/cortexprime/assets/plot-point/plot-point.png'
    dice3d.addDicePreset({
      type: 'dp',
      labels: [ppLabel, ppLabel],
      system: 'standard',
    }, 'd2')
  })

  Hooks.once('ready', async () => {
    const themes = game.settings.get('cortexprime', 'themes')
    const theme = themes.current === 'custom' ? themes.custom : themes.list[themes.current]
    setCssVars(theme)
    if (game.settings.get('cortexprime', 'WelcomeSeen') === false) {
      if (game.user.isGM) {
        const seeWelcome = await foundry.applications.api.DialogV2.confirm({
  window: {
    title: localizer('WelcomeTitle')
  },

  position: {
    width: 500
  },

  content: `
    <div class="bkg-lighter-grey ba-2-primary mb-4 pa-2">
      <p>${localizer('SettingsMessage')}</p>
    </div>
  `,

  yes: {
    label: localizer('Okay'),
    default: true
  },

  no: {
    label: localizer('Cancel')
  }
})

        if (seeWelcome) {
          await game.settings.set('cortexprime', 'WelcomeSeen', true)
        }
      }
    }

const rollPrivacy = document.querySelector('#roll-privacy')

if (rollPrivacy) {
  const dicePoolButton = document.createElement('button')
  dicePoolButton.className =
    'control dice-pool-control ui-control fa-solid fa-dice icon'
  dicePoolButton.type = 'button'
  dicePoolButton.dataset.control = 'dice-pool'
  dicePoolButton.ariaLabel = game.i18n.localize('DicePool')

  dicePoolButton.addEventListener('click', async () => {
    await game.cortexprime.UserDicePool.toggle()
  })

  rollPrivacy.prepend(dicePoolButton)
}

    })
  }

  Hooks.on('ready', async () => {
    game.cortexprime.UserDicePool = new UserDicePool()
    await game.cortexprime.UserDicePool.initPool()
  })

Hooks.on('renderChatMessageHTML', async (message, html, data) => {
  const root = html instanceof HTMLElement ? html : html?.[0]
  if (!root) return

  const rollResult = root.querySelector('.roll-result')
  if (!rollResult) return

  const chatMessage = rollResult.closest('.chat-message')

  if (chatMessage) {
    chatMessage.classList.add('roll-message')
    chatMessage.insertAdjacentHTML(
      'afterbegin',
      '<div class="message-background"></div><div class="message-image"></div>'
    )

    const messageHeader = chatMessage.querySelector('.message-header')

    if (messageHeader) {
      const headerContent = document.createElement('div')
      headerContent.className = 'message-header-content'

      while (messageHeader.firstChild) {
        headerContent.appendChild(messageHeader.firstChild)
      }

      messageHeader.appendChild(headerContent)

      messageHeader.insertAdjacentHTML(
        'afterbegin',
        '<div class="message-header-image"></div><div class="message-header-background"></div>'
      )
    }
  }

  const dice = rollResult.querySelectorAll('.die')

  for (const die of dice) {
    const { dieRating, type, value: number } = die.dataset

    const dieHtml =
      await foundry.applications.handlebars.renderTemplate(
        `systems/cortexprime/templates/partials/dice/d${dieRating}.html`,
        {
          type,
          number
        }
      )

    die.innerHTML = dieHtml
  }

  root.querySelectorAll('.source-header').forEach(sourceHeader => {
    sourceHeader.addEventListener('click', () => {
      sourceHeader
        .querySelector('.fa')
        ?.classList.toggle('fa-chevron-down')

      sourceHeader
        .querySelector('.fa')
        ?.classList.toggle('fa-chevron-up')

      const sourceContent =
        sourceHeader.parentElement?.querySelector('.source-content')

      sourceContent?.classList.toggle('hide')
    })
  })

  const getPool = element => {
    return [...element.querySelectorAll('.source')]
      .reduce((sources, source) => {
        sources[source.dataset.source] =
          [...source.querySelectorAll('.dice-tag')]
            .reduce((dice, die, dieIndex) => {
              dice[dieIndex] = {
                label: die.dataset.label,
                value: [...die.querySelectorAll('.die')]
                  .reduce((diceValues, dieValue, dieValueIndex) => {
                    diceValues[dieValueIndex] =
                      dieValue.dataset.dieRating

                    return diceValues
                  }, {})
              }

              return dice
            }, {})

        return sources
      }, {})
  }

  rollResult
    .querySelector('.re-roll')
    ?.addEventListener('click', async event => {
      event.preventDefault()

      const pool = getPool(rollResult)
      await rollDice(pool)
    })

  rollResult
    .querySelector('.send-to-pool')
    ?.addEventListener('click', async event => {
      event.preventDefault()

      const pool = getPool(rollResult)
      await game.cortexprime.UserDicePool._setPool(pool)
    })
})

  })
}
