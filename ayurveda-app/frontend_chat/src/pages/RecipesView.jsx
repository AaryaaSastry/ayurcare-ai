import React from 'react'
import './RecipesView.css'

const SECTION_LABELS = {
  benefits: 'Benefits',
  ingredients: 'Ingredients',
  preparation: 'Preparation',
  timing: 'Best time to take',
  precautions: 'Precautions'
}

const INLINE_SECTION_PATTERNS = [
  { key: 'title', regex: /(?:name of the dish(?:\/recipe)?|recipe name|dish name|name|title):/i },
  { key: 'benefits', regex: /benefits?:/i },
  { key: 'ingredients', regex: /ingredients?:/i },
  { key: 'preparation', regex: /(?:preparation steps|preparation|steps):/i },
  { key: 'timing', regex: /(?:when to consume|when to take|best time to consume|best time to take):/i },
  { key: 'precautions', regex: /precautions?:/i }
]

function normalizeLine(line) {
  return line
    .replace(/^[#*\-\d.\s]+/, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSectionKey(line) {
  const lowered = line.toLowerCase().replace(/[*#]/g, '').trim()

  if (lowered.startsWith('benefits:') || lowered.startsWith('benefit:')) return 'benefits'
  if (lowered.startsWith('ingredients:') || lowered.startsWith('ingredient:')) return 'ingredients'
  if (lowered.startsWith('preparation steps:') || lowered.startsWith('preparation:') || lowered.startsWith('steps:')) return 'preparation'
  if (lowered.startsWith('when to consume:') || lowered.startsWith('when to take:') || lowered.startsWith('best time to consume:') || lowered.startsWith('best time to take:')) return 'timing'
  if (lowered.startsWith('precautions:') || lowered.startsWith('precaution:')) return 'precautions'

  return null
}

function toBulletItems(text) {
  let list = text.split(/\n+/);
  if (list.length === 1 && text.match(/[\-\*]\s+/)) {
    list = text.split(/[\-\*]\s+/);
  } else if (list.length === 1) {
    list = text.split(/,(?=[A-Za-z])/);
  }
  
  return list
    .map(item => normalizeLine(item))
    .filter(Boolean)
}

function toStepItems(text) {
  // Try to split on line breaks or explicitly numbered steps (e.g., "1.", "2.")
  let list = text.split(/\n+/);
  if (list.length === 1 && text.match(/\d+\.\s/)) {
    // Single line with multiple numbered steps "1. xxx 2. yyy"
    list = text.split(/(?=\d+\.\s)/);
  } else if (list.length === 1) {
    // Single sentence paragraph
    list = text.split(/\.\s+(?=[A-Z])/);
  }

  return list
    .map(step => {
      // Clean up leading numbers/bullets and extra whitespace
      return normalizeLine(step.replace(/^\d+[\.\)]\s*/, '').trim());
    })
    .filter(Boolean);
}

function parseInlineSections(block, index) {
  const cleanBlock = block.replace(/[*#_`]/g, '');
  const recipe = {
    title: '',
    intro: [],
    benefits: [],
    ingredients: [],
    preparation: [],
    timing: [],
    precautions: []
  }

  const matches = INLINE_SECTION_PATTERNS
    .map(section => {
      const match = cleanBlock.match(section.regex)
      return match ? { ...section, position: match.index, length: match[0].length } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.position - b.position)

  if (matches.length === 0) return null

  // If no explicit title segment matched, treat everything before the first recognized section as the title
  if (matches[0].position > 0 && !matches.find(m => m.key === 'title')) {
    const fallbackTitleRaw = cleanBlock.slice(0, matches[0].position).trim()
    if (fallbackTitleRaw) {
      recipe.title = normalizeLine(fallbackTitleRaw.replace(/^(?:recipe ?\d*\s*:?|-?\s*name:?)\s*/i, '')).trim()
    }
  }

  matches.forEach((match, idx) => {
    const start = match.position + match.length
    const end = matches[idx + 1]?.position ?? cleanBlock.length
    const value = cleanBlock.slice(start, end).trim()
    if (!value) return

    if (match.key === 'title') {
      recipe.title = value
      return
    }

    if (match.key === 'ingredients') {
      recipe.ingredients.push(...toBulletItems(value))
      return
    }

    if (match.key === 'preparation') {
      recipe.preparation.push(...toStepItems(value))
      return
    }

    recipe[match.key].push(value)
  })

  return recipe
}

function parseRecipeBlock(block, index) {
  const inlineRecipe = parseInlineSections(block, index)
  if (inlineRecipe) return inlineRecipe

  const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
  const recipe = {
    title: '',
    intro: [],
    benefits: [],
    ingredients: [],
    preparation: [],
    timing: [],
    precautions: []
  }

  let activeSection = 'intro'

  lines.forEach((rawLine, lineIndex) => {
    const sectionKey = getSectionKey(rawLine)

    if (lineIndex === 0 && !sectionKey) {
      recipe.title = normalizeLine(rawLine)
      return
    }

    if (sectionKey) {
      activeSection = sectionKey
      const value = rawLine.split(':').slice(1).join(':').trim()
      if (!value) return

      if (sectionKey === 'ingredients') {
        recipe[sectionKey].push(...toBulletItems(value))
      } else if (sectionKey === 'preparation') {
        recipe[sectionKey].push(...toStepItems(value))
      } else {
        recipe[sectionKey].push(normalizeLine(value))
      }
      return
    }

    const cleanLine = normalizeLine(rawLine)
    if (!cleanLine) return

    if (activeSection === 'ingredients') {
      recipe.ingredients.push(...toBulletItems(cleanLine))
      return
    }

    if (activeSection === 'preparation') {
      recipe.preparation.push(...toStepItems(cleanLine))
      return
    }

    recipe[activeSection].push(cleanLine)
  })

  return recipe
}

function hasRecipeSections(recipe) {
  return Boolean(
    recipe.ingredients.length
    || recipe.preparation.length
    || recipe.timing.length
    || recipe.precautions.length
    || recipe.benefits.length
  )
}

function isIntroOnlyBlock(recipe) {
  return !hasRecipeSections(recipe) && Boolean(recipe.title || recipe.intro.length)
}

function parseRecipes(recipes) {
  const blocks = recipes
    .split(/---RECIPE---/i)
    .map(block => block.trim())
    .filter(Boolean)

  const parsedRecipes = blocks.map(parseRecipeBlock)
  let intro = ''

  if (parsedRecipes.length > 0 && parsedRecipes[0] && isIntroOnlyBlock(parsedRecipes[0])) {
    intro = [parsedRecipes[0].title, ...parsedRecipes[0].intro].filter(Boolean).join(' ')
    parsedRecipes.shift()
  }

  return {
    intro,
    recipes: parsedRecipes
  }
}

function RecipeSection({ title, items, accent = 'leaf', variant = 'bullets' }) {
  if (!items.length) return null

  return (
    <section className={`recipe-section recipe-section-${accent}`}>
      <h3>{title}</h3>
      {variant === 'steps' ? (
        <ol className="recipe-steps">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>
              <span className="step-label">Step {index + 1}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function RecipesView({ recipes, embedded = false }) {
  if (!recipes) return null

  const { intro, recipes: parsedRecipes } = parseRecipes(recipes)

  return (
    <div className={`recipes-view${embedded ? ' embedded' : ''}`}>
      {!embedded && (
        <div className="recipes-header-copy standalone">
          <p className="recipes-eyebrow">Personalized plan</p>
          <h1>Ayurvedic Recipes</h1>
          <p className="recipes-subtitle">
            Discover personalized ayurvedic recipes tailored to your unique constitution and health goals.
          </p>
        </div>
      )}

      <div className="recipes-content">
        {/* intro && (
          <section className="recipes-intro-card">
            <p>{intro}</p>
          </section>
        ) */}

        {parsedRecipes.map((recipe, idx) => (
          <article key={`${recipe.title}-${idx}`} className="recipe-card">
            <div className="recipe-card-top">
              <span className="recipe-badge">Recipe {idx + 1}</span>
              {recipe.title && (
                <h2 className="recipe-title">{recipe.title}</h2>
              )}
              {/* recipe.intro.length > 0 && (
                <p className="recipe-intro">{recipe.intro.join(' ')}</p>
              ) */}
            </div>

            <div className="recipe-sections">
              <RecipeSection title={SECTION_LABELS.benefits} items={recipe.benefits} accent="accent" />
              <RecipeSection title={SECTION_LABELS.ingredients} items={recipe.ingredients} accent="earth" />
              <RecipeSection title={SECTION_LABELS.preparation} items={recipe.preparation} accent="leaf" variant="steps" />
              <RecipeSection title={SECTION_LABELS.precautions} items={recipe.precautions} accent="earth" />
              <RecipeSection title={SECTION_LABELS.timing} items={recipe.timing} accent="accent" />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
