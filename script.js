// script.js – Smart Inventory, vanilla, localStorage
document.addEventListener('DOMContentLoaded', function () {
  // ----- strict DOM selections (no implicit globals) -----
  const viewContainer = document.getElementById('viewContainer');
  const bottomNav = document.getElementById('bottomNav');
  const fabAdd = document.getElementById('fabAddProduct');
  const productModal = document.getElementById('productModal');
  const deleteModal = document.getElementById('deleteModal');
  const modalTitle = document.getElementById('modalTitle');
  const productName = document.getElementById('productName');
  const buyPrice = document.getElementById('buyPrice');
  const sellPrice = document.getElementById('sellPrice');
  const stockQty = document.getElementById('stockQty');
  const saveProductBtn = document.getElementById('saveProductBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

  // sales elements (will be re-queried when switching tabs, but keep reference)
  let salesProductSelect = null;
  let salesQtySpan = null;
  let completeSaleBtn = null;

  // ----- state -----
  let products = [];
  let sales = [];
  let currentView = 'home'; // home, products, sales, report
  let editingProductId = null; // for modal
  let productToDelete = null;   // { id, name }

  // ----- load / save storage -----
  function loadFromStorage() {
    try {
      products = JSON.parse(localStorage.getItem('inventory_products')) || [];
    } catch { products = []; }
    try {
      sales = JSON.parse(localStorage.getItem('inventory_sales')) || [];
    } catch { sales = []; }
  }
  function saveProducts() {
    localStorage.setItem('inventory_products', JSON.stringify(products));
  }
  function saveSales() {
    localStorage.setItem('inventory_sales', JSON.stringify(sales));
  }

  // helpers
  function getThisMonthRevenueProfit() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let revenue = 0, profit = 0;
    for (let s of sales) {
      if (!s.date) continue;
      const d = new Date(s.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        revenue += s.revenue || 0;
        profit += s.profit || 0;
      }
    }
    return { revenue, profit };
  }

  // ----- render view based on currentView -----
  function renderView() {
    if (currentView === 'home') renderHome();
    else if (currentView === 'products') renderProducts();
    else if (currentView === 'sales') renderSales();
    else if (currentView === 'report') renderReport();

    // highlight active nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      if (tab === currentView) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // FAB only visible in products
    if (currentView === 'products') {
      fabAdd.style.display = 'flex';
    } else {
      fabAdd.style.display = 'none';
    }
  }

  function renderHome() {
    const lowStock = products.filter(p => p.stock < 20).length;
    const totalProd = products.length;
    const { revenue, profit } = getThisMonthRevenueProfit();

    viewContainer.innerHTML = `
      <div class="dashboard-grid">
        <div class="stat-card"><span class="stat-label">📦 total products</span><div class="stat-value">${totalProd}</div></div>
        <div class="stat-card"><span class="stat-label">⚠️ low stock (<20)</span><div class="stat-value">${lowStock}</div></div>
        <div class="stat-card"><span class="stat-label">💰 month revenue</span><div class="stat-value">₹${revenue}</div></div>
        <div class="stat-card"><span class="stat-label">📈 month profit</span><div class="stat-value">₹${profit}</div></div>
      </div>
    `;
  }

  function renderProducts() {
    if (!products.length) {
      viewContainer.innerHTML = `<div class="stat-card" style="padding:40px; text-align:center;">✨ no products yet.<br> tap + to add</div>`;
      return;
    }
    let html = '<div class="products-grid">';
    products.forEach(p => {
      const stockClass = p.stock >= 20 ? 'green' : 'red';
      html += `
        <div class="product-card" data-product-id="${p.id}">
          <div class="product-header">
            <span class="product-name">${escapeHtml(p.name) || '?'}</span>
            <div class="product-actions">
              <button class="icon-btn edit" data-action="edit" data-id="${p.id}">✏️</button>
              <button class="icon-btn delete" data-action="delete" data-id="${p.id}">🗑️</button>
            </div>
          </div>
          <div class="product-detail">buy ₹${p.buy} · sell ₹${p.sell}</div>
          <div class="stock-badge ${stockClass}">stock: ${p.stock}</div>
        </div>
      `;
    });
    html += '</div>';
    viewContainer.innerHTML = html;

    // attach listeners to edit/delete (after rendering)
    document.querySelectorAll('.icon-btn.edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openEditModal(id);
      });
    });
    document.querySelectorAll('.icon-btn.delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const prod = products.find(p => p.id === id);
        if (prod) { productToDelete = { id: prod.id, name: prod.name }; showDeleteModal(); }
      });
    });
  }

  function renderSales() {
    if (!products.length) {
      viewContainer.innerHTML = `<div class="stat-card">add products before sale</div>`;
      return;
    }
    viewContainer.innerHTML = `
      <div class="sales-selector">
        <label for="salesProductSelect">choose product</label>
        <select id="salesProductSelect">
          ${products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (stock: ${p.stock})</option>`).join('')}
        </select>
        <div class="quantity-control">
          <button class="qty-btn" id="salesDec">−</button>
          <span id="salesQty">1</span>
          <button class="qty-btn" id="salesInc">+</button>
        </div>
        <button class="complete-sale-btn" id="completeSaleBtn">✅ complete sale</button>
      </div>
    `;
    salesProductSelect = document.getElementById('salesProductSelect');
    salesQtySpan = document.getElementById('salesQty');
    const salesDec = document.getElementById('salesDec');
    const salesInc = document.getElementById('salesInc');
    completeSaleBtn = document.getElementById('completeSaleBtn');

    let qty = 1;
    function updateQtyDisplay() { if (salesQtySpan) salesQtySpan.innerText = qty; }

    if (salesDec) salesDec.addEventListener('click', () => {
      if (qty > 1) qty--;
      updateQtyDisplay();
    });
    if (salesInc) salesInc.addEventListener('click', () => {
      const selectedId = salesProductSelect?.value;
      const prod = products.find(p => p.id === selectedId);
      if (prod && qty < prod.stock) qty++;
      else if (prod && qty >= prod.stock) { alert('not enough stock'); }
      updateQtyDisplay();
    });

    if (completeSaleBtn) {
      completeSaleBtn.addEventListener('click', () => {
        const selectedId = salesProductSelect?.value;
        const prod = products.find(p => p.id === selectedId);
        if (!prod) return;
        if (prod.stock < qty) { alert('insufficient stock'); return; }
        // perform sale
        prod.stock -= qty;
        const revenue = prod.sell * qty;
        const profit = (prod.sell - prod.buy) * qty;
        sales.push({
          productId: prod.id,
          revenue,
          profit,
          date: new Date().toISOString()
        });
        saveProducts();
        saveSales();
        // refresh sales view (reset qty)
        if (currentView === 'sales') renderSales();
        else renderView(); // fallback
      });
    }
  }

  function renderReport() {
    const { revenue, profit } = getThisMonthRevenueProfit();
    viewContainer.innerHTML = `
      <div class="report-card">
        <div class="report-row"><span class="report-label">📅 this month revenue</span> <span>₹${revenue}</span></div>
        <div class="report-row"><span class="report-label">📈 this month profit</span> <span>₹${profit}</span></div>
      </div>
    `;
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[&<>"]/g, function(m) {
      if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; if (m === '"') return '&quot;';
      return m;
    });
  }

  // ----- modal logic -----
  function openEditModal(id = null) {
    editingProductId = id;
    if (id) {
      const prod = products.find(p => p.id === id);
      if (prod) {
        modalTitle.innerText = '✏️ edit product';
        productName.value = prod.name || '';
        buyPrice.value = prod.buy;
        sellPrice.value = prod.sell;
        stockQty.value = prod.stock;
      }
    } else {
      modalTitle.innerText = '➕ new product';
      productName.value = ''; buyPrice.value = ''; sellPrice.value = ''; stockQty.value = '';
    }
    productModal.style.display = 'flex';
  }

  function closeProductModal() { productModal.style.display = 'none'; editingProductId = null; }
  function showDeleteModal() { deleteModal.style.display = 'flex'; }
  function closeDeleteModal() { deleteModal.style.display = 'none'; productToDelete = null; }

  // save product
  saveProductBtn.addEventListener('click', () => {
    const name = productName.value.trim();
    const buy = parseFloat(buyPrice.value);
    const sell = parseFloat(sellPrice.value);
    const stock = parseInt(stockQty.value, 10);
    if (!name || isNaN(buy) || isNaN(sell) || isNaN(stock) || buy < 0 || sell < 0 || stock < 0) {
      alert('please fill valid numbers');
      return;
    }
    if (editingProductId) {
      const idx = products.findIndex(p => p.id === editingProductId);
      if (idx !== -1) {
        products[idx] = { ...products[idx], name, buy, sell, stock };
      }
    } else {
      const newId = Date.now().toString() + '-' + Math.random().toString(36).substring(2,6);
      products.push({ id: newId, name, buy, sell, stock });
    }
    saveProducts();
    closeProductModal();
    if (currentView === 'products') renderProducts();
    else renderView(); // safety
  });

  cancelModalBtn.addEventListener('click', closeProductModal);
  cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  confirmDeleteBtn.addEventListener('click', () => {
    if (productToDelete) {
      products = products.filter(p => p.id !== productToDelete.id);
      saveProducts();
      closeDeleteModal();
      if (currentView === 'products') renderProducts();
      else renderView();
    }
  });

  // navigation
  bottomNav.addEventListener('click', (e) => {
    const navItem = e.target.closest('.nav-item');
    if (!navItem) return;
    const tab = navItem.getAttribute('data-tab');
    if (!tab) return;
    currentView = tab;
    renderView();
  });

  // FAB open modal for new
  fabAdd.addEventListener('click', () => openEditModal(null));

  // initialise
  loadFromStorage();
  renderView();

  // close modal if click outside (optional)
  window.addEventListener('click', (e) => {
    if (e.target === productModal) closeProductModal();
    if (e.target === deleteModal) closeDeleteModal();
  });
});
