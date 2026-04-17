import { supabase } from './supabase.js'

// --- 1. DOM ELEMENTS ---
const jsonInput = document.getElementById('json-input');
const saveBtn = document.getElementById('save-btn');
const statusMessage = document.getElementById('status-message');
const vaultGrid = document.getElementById('vault-grid');
const searchInput = document.getElementById('search-input');
const proteinFilter = document.getElementById('filter-protein');
const cuisineFilter = document.getElementById('filter-cuisine');
const plannerGrid = document.getElementById('planner-grid');
const dishTypeFilter = document.getElementById('filter-dish-type');

// --- 2. GLOBAL STATE ---
let activeWeek = 'current'; 
let pendingRecipeId = null;
let recipeToDelete = null;

// --- 3. CORE UI: LOAD RECIPE VAULT ---
async function loadRecipes() {
  const searchTerm = searchInput?.value.toLowerCase() || "";
  const selectedProtein = proteinFilter?.value || "all";
  const selectedCuisine = cuisineFilter?.value || "all";
  const selectedDishType = document.getElementById('filter-dish-type')?.value || "all"; // Make sure this matches your HTML ID

  try {
    const { data: recipes, error } = await supabase
      .from('aisle_recipes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Build the dropdowns first
    updateFilterDropdowns(recipes);

    // Apply the 3-way filter
    const filteredRecipes = recipes.filter(recipe => {
      const matchesSearch = (recipe.title || '').toLowerCase().includes(searchTerm);
      const matchesProtein = selectedProtein === 'all' || (recipe.tags?.protein?.toLowerCase() === selectedProtein);
      const matchesCuisine = selectedCuisine === 'all' || (recipe.tags?.cuisine?.toLowerCase() === selectedCuisine);
      const matchesType = selectedDishType === 'all' || (recipe.tags?.dish_type?.toLowerCase() === selectedDishType);

      return matchesSearch && matchesProtein && matchesCuisine && matchesType;
    });

    renderVaultGrid(filteredRecipes);

  } catch (error) {
    console.error('Error loading recipes:', error.message);
    if (vaultGrid) vaultGrid.innerHTML = `<p class="text-red-400 col-span-full text-center py-10">Error loading recipes: ${error.message}</p>`;
  }
}

function updateFilterDropdowns(recipes) {
  const proteinSelect = document.getElementById('filter-protein');
  const cuisineSelect = document.getElementById('filter-cuisine');
  const dishTypeSelect = document.getElementById('filter-dish-type');

  if (!proteinSelect || !cuisineSelect || !dishTypeSelect) return;

  // FIX: Explicitly declaring these variables with 'const'
  const currentProtein = proteinSelect.value;
  const currentCuisine = cuisineSelect.value;
  const currentDishType = dishTypeSelect.value;

  const proteins = new Set();
  const cuisines = new Set();
  const dishTypes = new Set();

  recipes.forEach(r => {
    if (r.tags?.protein) proteins.add(r.tags.protein.toLowerCase().trim());
    if (r.tags?.cuisine) cuisines.add(r.tags.cuisine.toLowerCase().trim());
    if (r.tags?.dish_type) dishTypes.add(r.tags.dish_type.toLowerCase().trim());
  });

  // Re-build Protein Dropdown
  proteinSelect.innerHTML = '<option value="all">All Proteins</option>' + 
    Array.from(proteins).sort().map(p => 
      `<option value="${p}" ${p === currentProtein ? 'selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`
    ).join('');

  // Re-build Cuisine Dropdown
  cuisineSelect.innerHTML = '<option value="all">All Cuisines</option>' + 
    Array.from(cuisines).sort().map(c => 
      `<option value="${c}" ${c === currentCuisine ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
    ).join('');

  // Re-build Dish Type Dropdown
  dishTypeSelect.innerHTML = '<option value="all">All Types</option>' + 
    Array.from(dishTypes).sort().map(d => 
      `<option value="${d}" ${d === currentDishType ? 'selected' : ''}>${d.charAt(0).toUpperCase() + d.slice(1)}</option>`
    ).join('');
}

function renderVaultGrid(recipes) {
  if (recipes.length === 0) {
    vaultGrid.innerHTML = '<p class="text-gray-400 col-span-full text-center py-10">No recipes match your search.</p>';
    return;
  }

  vaultGrid.innerHTML = recipes.map(recipe => `
    <div class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group">
      <div class="h-44 overflow-hidden relative cursor-pointer" onclick="viewRecipe('${recipe.id}')">
        <img src="${recipe.image_url}" class="w-full h-full object-cover group-hover:scale-110 transition duration-700">
        ${recipe.tags?.cuisine ? `<span class="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">${recipe.tags.cuisine}</span>` : ''}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
          <span class="text-white text-xs font-bold uppercase tracking-widest">Open Recipe</span>
        </div>
      </div>
      <div class="p-5">
        <h3 class="text-lg font-bold text-gray-900 mb-1 truncate cursor-pointer hover:text-blue-600" onclick="viewRecipe('${recipe.id}')">${recipe.title}</h3>
        <div class="flex items-center gap-2 mb-4">
          <p class="text-[10px] font-bold text-gray-400 uppercase">${recipe.prep_time_minutes}m Prep</p>
          ${recipe.tags?.protein ? `<span class="w-1 h-1 bg-gray-300 rounded-full"></span><span class="text-[10px] font-bold text-blue-500 uppercase">${recipe.tags.protein}</span>` : ''}
          ${recipe.tags?.dish_type ? `<span class="w-1 h-1 bg-gray-300 rounded-full"></span><span class="text-[10px] font-bold text-green-600 uppercase">${recipe.tags.dish_type}</span>` : ''}
        </div>
        <button onclick="addToPlan('${recipe.id}')" class="w-full py-2.5 bg-gray-50 hover:bg-black hover:text-white text-gray-900 text-xs font-black uppercase tracking-widest rounded-xl transition">Add to Plan</button>
      </div>
    </div>
  `).join('');
}

// --- 4. MODAL CONTROLS & DELETE ---
window.viewRecipe = async (id) => {
  const { data: recipe } = await supabase.from('aisle_recipes').select('*').eq('id', id).single();
  const { data: ingredients } = await supabase.from('aisle_recipe_ingredients').select('*').eq('recipe_id', id);

  const modal = document.getElementById('recipe-modal');
  const content = document.getElementById('modal-content');
  const deleteBtn = document.getElementById('delete-recipe-btn');

  content.innerHTML = `
    <img src="${recipe.image_url}" class="w-full h-64 object-cover rounded-t-3xl md:rounded-t-2xl mb-6 shadow-inner">
    <div class="flex justify-between items-start mb-2">
      <h2 class="text-3xl font-black leading-tight">${recipe.title}</h2>
      ${recipe.source_url ? `<a href="${recipe.source_url}" target="_blank" class="text-blue-500 p-2 bg-blue-50 rounded-lg"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg></a>` : ''}
    </div>
    <div class="flex flex-wrap gap-2 mb-6">
      ${recipe.tags?.protein ? `<span class="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-md border border-blue-100">${recipe.tags.protein}</span>` : ''}
      ${recipe.tags?.cuisine ? `<span class="px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase rounded-md border border-orange-100">${recipe.tags.cuisine}</span>` : ''}
      ${recipe.tags?.dish_type ? `<span class="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase rounded-md border border-green-100">${recipe.tags.dish_type}</span>` : ''}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h4 class="font-black uppercase tracking-widest text-blue-500 text-xs mb-4">Ingredients</h4>
        <ul class="space-y-2">
          ${ingredients.map(ing => `<li class="text-sm font-medium border-b border-gray-50 pb-2 flex justify-between"><span>${ing.item_name}</span><span class="text-gray-400">${decimalToFraction(ing.quantity)} ${ing.unit}</span></li>`).join('')}
        </ul>
      </div>
      <div>
        <h4 class="font-black uppercase tracking-widest text-green-500 text-xs mb-4">Instructions</h4>
        <div class="space-y-4">
          ${recipe.instructions.map((step, i) => `<div class="flex gap-3"><span class="font-black text-gray-200 text-xl leading-none">${i+1}</span><p class="text-sm text-gray-600 leading-relaxed">${step}</p></div>`).join('')}
        </div>
      </div>
    </div>
  `;
  deleteBtn.onclick = () => deleteRecipe(id);
  modal.classList.remove('hidden');
};

window.closeRecipeModal = () => document.getElementById('recipe-modal').classList.add('hidden');
window.closeDeleteModal = () => document.getElementById('delete-confirm-modal').classList.add('hidden');
window.closeModal = () => document.getElementById('plan-modal').classList.add('hidden');

window.deleteRecipe = (id) => {
  recipeToDelete = id;
  document.getElementById('delete-confirm-modal').classList.remove('hidden');
};

document.getElementById('confirm-delete-final').onclick = async () => {
  if (!recipeToDelete) return;
  await supabase.from('aisle_recipes').delete().eq('id', recipeToDelete);
  closeDeleteModal();
  closeRecipeModal();
  loadRecipes();
  loadWeeklyPlan();
};

// --- 5. WEEKLY PLANNER LOGIC ---
function getWeekDates(weekType) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMon = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const startOfWeek = new Date(now.setDate(diffToMon));
  if (weekType === 'next') startOfWeek.setDate(startOfWeek.getDate() + 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    days.push({
      dateString: d.toISOString().split('T')[0],
      displayDay: d.toLocaleDateString('en-US', { weekday: 'short' }),
      displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    });
  }
  return days;
}

window.changeWeek = (type) => {
  activeWeek = type;
  document.getElementById('btn-curr').className = type === 'current' ? 'px-4 py-1.5 rounded-md text-sm font-medium bg-white shadow-sm' : 'px-4 py-1.5 rounded-md text-sm font-medium text-gray-500';
  document.getElementById('btn-next').className = type === 'next' ? 'px-4 py-1.5 rounded-md text-sm font-medium bg-white shadow-sm' : 'px-4 py-1.5 rounded-md text-sm font-medium text-gray-500';
  document.getElementById('week-label').textContent = type === 'current' ? 'Current Week' : 'Upcoming Week';
  loadWeeklyPlan();
};

async function loadWeeklyPlan() {
  const days = getWeekDates(activeWeek);
  const { data: plans } = await supabase.from('aisle_weekly_plan').select(`id, date, aisle_recipes (id, title, image_url)`).in('date', days.map(d => d.dateString));
  
  plannerGrid.innerHTML = days.map(day => {
    const recipesForDay = plans ? plans.filter(p => p.date === day.dateString) : [];
    return `
      <div class="bg-white border border-gray-200 rounded-xl p-3 flex flex-col min-h-[160px] shadow-sm">
        <span class="text-[10px] font-bold uppercase text-gray-400">${day.displayDay}</span>
        <span class="text-xs font-semibold text-gray-700 mb-3">${day.displayDate}</span>
        <div class="space-y-2">
          ${recipesForDay.map(plan => `
            <div class="group relative bg-blue-50 border border-blue-100 p-1.5 rounded-lg flex items-center gap-2">
              <img src="${plan.aisle_recipes.image_url}" class="w-6 h-6 rounded-md object-cover">
              <p class="text-[10px] font-bold text-blue-900 leading-tight flex-1 break-words">${plan.aisle_recipes.title}</p>
              <button onclick="removeFromPlan('${plan.id}')" class="opacity-0 group-hover:opacity-100 text-red-500 font-bold px-1 transition">×</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

window.addToPlan = (recipeId) => {
  pendingRecipeId = recipeId;
  const days = getWeekDates(activeWeek);
  document.getElementById('modal-day-selector').innerHTML = days.map(day => `<button onclick="confirmAddToPlan('${day.dateString}')" class="py-3 px-2 bg-gray-50 hover:bg-black hover:text-white border border-gray-200 rounded-xl text-xs font-bold transition">${day.displayDay}<br><span class="font-normal opacity-60">${day.displayDate}</span></button>`).join('');
  document.getElementById('plan-modal').classList.remove('hidden');
};

window.confirmAddToPlan = async (date) => {
  await supabase.from('aisle_weekly_plan').insert([{ date: date, recipe_id: pendingRecipeId }]);
  closeModal();
  loadWeeklyPlan();
};

window.removeFromPlan = async (id) => {
  await supabase.from('aisle_weekly_plan').delete().eq('id', id);
  loadWeeklyPlan();
};

// --- 6. SHOPPING LIST ENGINE ---
function decimalToFraction(decimal) {
  if (decimal % 1 === 0) return decimal.toString();
  const highOrder = Math.floor(decimal);
  const remainder = decimal % 1;
  let fraction = remainder.toFixed(2);
  if (remainder === 0.5) fraction = "1/2";
  else if (remainder === 0.25) fraction = "1/4";
  else if (remainder === 0.75) fraction = "3/4";
  return highOrder > 0 ? `${highOrder} ${fraction}` : fraction;
}

window.generateShoppingList = async () => {
  const container = document.getElementById('shopping-list-container');
  container.innerHTML = '<p class="text-blue-600 animate-pulse text-center">Combining both weeks...</p>';
  const allDates = [...getWeekDates('current').map(d => d.dateString), ...getWeekDates('next').map(d => d.dateString)];

  const { data: plans } = await supabase.from('aisle_weekly_plan').select('recipe_id').in('date', allDates);
  if (!plans || plans.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center">No recipes planned!</p>';
    return;
  }

  const { data: ingredients } = await supabase.from('aisle_recipe_ingredients').select('*').in('recipe_id', plans.map(p => p.recipe_id));

  const totals = ingredients.reduce((acc, ing) => {
    const key = `${ing.item_name.toLowerCase().trim()}-${ing.unit.toLowerCase().trim()}`;
    if (!acc[key]) acc[key] = { ...ing, quantity: 0 };
    acc[key].quantity += Number(ing.quantity);
    return acc;
  }, {});

  const grouped = Object.values(totals).reduce((acc, ing) => {
    if (!acc[ing.category]) acc[ing.category] = [];
    acc[ing.category].push(ing);
    return acc;
  }, {});

  container.innerHTML = Object.keys(grouped).sort().map(cat => `
    <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <h3 class="text-sm font-black uppercase tracking-widest text-blue-500 mb-4">${cat}</h3>
      <ul class="space-y-3">
        ${grouped[cat].map(ing => `<li class="flex items-center gap-3 group cursor-pointer" onclick="this.classList.toggle('opacity-30')"><div class="w-5 h-5 border-2 border-gray-200 rounded-md transition"></div><span class="text-gray-700 font-medium">${decimalToFraction(ing.quantity)} ${ing.unit} <span class="font-bold text-gray-900">${ing.item_name}</span></span></li>`).join('')}
      </ul>
    </div>
  `).join('');
};

window.clearFullMealPlan = async () => {
  if (confirm("Delete ALL planned meals for both weeks?")) {
    await supabase.from('aisle_weekly_plan').delete().neq('id', 0);
    loadWeeklyPlan();
    document.getElementById('shopping-list-container').innerHTML = '<p class="text-gray-400 italic">Plan cleared.</p>';
  }
};

// --- 7. SAVE RECIPE LOGIC ---
async function saveRecipeToDatabase() {
  statusMessage.textContent = 'Saving...';
  try {
    const recipe = JSON.parse(jsonInput.value);
    const { data: insertedRecipe, error } = await supabase.from('aisle_recipes').insert([{
      title: recipe.title, tags: recipe.tags, source_url: recipe.source_url,
      image_url: recipe.image_url, prep_time_minutes: recipe.prep_time_minutes,
      cook_time_minutes: recipe.cook_time_minutes, servings: recipe.servings,
      instructions: recipe.instructions
    }]).select();

    if (error) throw error;
    const ingredients = recipe.ingredients.map(ing => ({ ...ing, recipe_id: insertedRecipe[0].id }));
    await supabase.from('aisle_recipe_ingredients').insert(ingredients);

    statusMessage.textContent = '✅ Saved!';
    jsonInput.value = '';
    await loadRecipes();
  } catch (err) { statusMessage.textContent = `❌ ${err.message}`; }
}

// --- 8. INITIALIZATION & LISTENERS ---
saveBtn?.addEventListener('click', saveRecipeToDatabase);
searchInput?.addEventListener('input', loadRecipes);
proteinFilter?.addEventListener('change', loadRecipes);
cuisineFilter?.addEventListener('change', loadRecipes);

window.addEventListener('click', (e) => {
  if (e.target.id === 'recipe-modal') closeRecipeModal();
  if (e.target.id === 'plan-modal') closeModal();
  if (e.target.id === 'delete-confirm-modal') closeDeleteModal();
});

// Start the app
loadRecipes();
changeWeek('current');
loadWeeklyPlan();

dishTypeFilter?.addEventListener('change', loadRecipes);