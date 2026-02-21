// script.js — complete inventory with localStorage, insights, modals

(function() {
    // ----- state -----
    let products = [];               // array of { id, name, price, stock }
    let nextId = 1;

    // DOM elements
    const productGrid = document.getElementById('productGrid');
    const insightPanel = document.getElementById('insightPanel');
    const insightToggleBtn = document.getElementById('insightToggleBtn');
    const closeInsightBtn = document.getElementById('closeInsightBtn');
    const insightContent = document.getElementById('insightContent');

    // add/edit modal
    const productModal = document.getElementById('productModal');
    const modalTitle = document.getElementById('modalTitle');
    const productForm = document.getElementById('productForm');
    const productId = document.getElementById('productId');
    const itemName = document.getElementById('itemName');
    const itemPrice = document.getElementById('itemPrice');
    const itemStock = document.getElementById('itemStock');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const openAddModalBtn = document.getElementById('openAddModalBtn');

    // sell modal
    const sellModal = document.getElementById('sellModal');
    const sellProductInfo = document.getElementById('sellProductInfo');
    const sellForm = document.getElementById('sellForm');
    const sellQuantity = document.getElementById('sellQuantity');
    const cancelSellBtn = document.getElementById('cancelSellBtn');

    // current product being sold (id)
    let currentSellId = null;

    // ----- init / load from localStorage -----
    function loadFromStorage() {
        const stored = localStorage.getItem('stockflow_products');
        if (stored) {
            try {
                products = JSON.parse(stored);
                // determine nextId
                if (products.length > 0) {
                    nextId = Math.max(...products.map(p => p.id)) + 1;
                } else {
                    nextId = 1;
                }
            } catch (e) {
                products = [];
                nextId = 1;
            }
        } else {
            // demo default products
            products = [
                { id: 1, name: 'Basmati rice 5kg', price: 320, stock: 15 },
                { id: 2, name: 'Cooking oil 1L', price: 110, stock: 8 },
                { id: 3, name: 'Wheat flour 10kg', price: 280, stock: 4 },
                { id: 4, name: 'Sugar 5kg', price: 190, stock: 12 },
            ];
            nextId = 5;
            saveToStorage();
        }
    }

    function saveToStorage() {
        localStorage.setItem('stockflow_products', JSON.stringify(products));
    }

    // ----- render product grid -----
    function renderProducts() {
        if (products.length === 0) {
            productGrid.innerHTML = `<div class="empty-state">✨ inventory empty<br>tap + to add items</div>`;
            return;
        }

        let html = '';
        products.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
            html += `
                <div class="product-card" data-id="${p.id}">
                    <div class="product-info">
                        <div class="product-name">${escapeHtml(p.name)}</div>
                        <div class="product-meta">
                            <span class="product-price">₹${p.price.toFixed(2)}</span>
                            <span class="product-stock">${p.stock} pcs</span>
                        </div>
                    </div>
                    <div class="product-actions">
                        <button class="icon-btn sell" data-sell-id="${p.id}" aria-label="sell">💰</button>
                        <button class="icon-btn edit" data-edit-id="${p.id}" aria-label="edit">✎</button>
                        <button class="icon-btn delete" data-delete-id="${p.id}" aria-label="delete">🗑️</button>
                    </div>
                </div>
            `;
        });
        productGrid.innerHTML = html;

        // attach event listeners to action buttons (delegation also works but explicit)
        document.querySelectorAll('[data-sell-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.sellId);
                openSellModal(id);
            });
        });
        document.querySelectorAll('[data-edit-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.editId);
                openEditModal(id);
            });
        });
        document.querySelectorAll('[data-delete-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.dataset.deleteId);
                confirmDelete(id);
            });
        });
    }

    // simple escape for innerHTML safety
    function escapeHtml(unsafe) {
        return unsafe.replace(/[&<>"]/g, function(m) {
            if(m === '&') return '&amp;'; if(m === '<') return '&lt;'; if(m === '>') return '&gt;'; if(m === '"') return '&quot;';
            return m;
        });
    }

    // ----- insights update -----
    function updateInsights() {
        const totalItems = products.reduce((acc, p) => acc + p.stock, 0);
        const totalValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
        const uniqueProducts = products.length;

        let lowStock = products.filter(p => p.stock > 0 && p.stock <= 3).length;

        const mostExpensive = products.length ? Math.max(...products.map(p => p.price)) : 0;

        insightContent.innerHTML = `
            <div class="stat-item"><span class="stat-label">📦 total stock units</span><span class="stat-value">${totalItems}</span></div>
            <div class="stat-item"><span class="stat-label">💰 inventory value</span><span class="stat-value">₹${totalValue.toFixed(2)}</span></div>
            <div class="stat-item"><span class="stat-label">📋 unique products</span><span class="stat-value">${uniqueProducts}</span></div>
            <div class="stat-item"><span class="stat-label">⚠️ low stock (≤3)</span><span class="stat-value">${lowStock}</span></div>
            <div class="stat-item"><span class="stat-label">🏷️ highest price</span><span class="stat-value">₹${mostExpensive.toFixed(2)}</span></div>
        `;
    }

    // ----- modal controls -----
    function openAddModal() {
        modalTitle.innerText = '➕ add product';
        productId.value = '';
        itemName.value = '';
        itemPrice.value = '';
        itemStock.value = '';
        productModal.classList.add('active');
    }

    function openEditModal(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;
        modalTitle.innerText = '✎ edit product';
        productId.value = product.id;
        itemName.value = product.name;
        itemPrice.value = product.price;
        itemStock.value = product.stock;
        productModal.classList.add('active');
    }

    function closeProductModal() {
        productModal.classList.remove('active');
    }

    function openSellModal(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;
        if (product.stock <= 0) {
            alert('⚠️ out of stock');
            return;
        }
        currentSellId = id;
        sellProductInfo.innerText = `${product.name} (₹${product.price}) — stock: ${product.stock}`;
        sellQuantity.value = '1';
        sellQuantity.max = product.stock;
        sellModal.classList.add('active');
    }

    function closeSellModal() {
        sellModal.classList.remove('active');
        currentSellId = null;
    }

    // ----- delete with confirmation -----
    function confirmDelete(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;
        if (confirm(`Delete "${product.name}"?`)) {
            products = products.filter(p => p.id !== id);
            saveToStorage();
            renderProducts();
            updateInsights();
        }
    }

    // ----- form handlers -----
    productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = itemName.value.trim();
        const price = parseFloat(itemPrice.value);
        const stock = parseInt(itemStock.value, 10);
        if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
            alert('please fill valid fields');
            return;
        }

        const id = productId.value ? Number(productId.value) : null;
        if (id) {
            // edit
            const index = products.findIndex(p => p.id === id);
            if (index !== -1) {
                products[index] = { ...products[index], name, price, stock };
            }
        } else {
            // add
            const newId = nextId++;
            products.push({ id: newId, name, price, stock });
        }

        saveToStorage();
        renderProducts();
        updateInsights();
        closeProductModal();
    });

    sellForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentSellId) return;
        const product = products.find(p => p.id === currentSellId);
        if (!product) return;

        const qty = parseInt(sellQuantity.value, 10);
        if (isNaN(qty) || qty <= 0) {
            alert('enter positive number');
            return;
        }
        if (qty > product.stock) {
            alert(`only ${product.stock} in stock`);
            return;
        }

        // reduce stock
        product.stock -= qty;
        saveToStorage();
        renderProducts();
        updateInsights();
        closeSellModal();
    });

    // cancel buttons
    cancelModalBtn.addEventListener('click', closeProductModal);
    cancelSellBtn.addEventListener('click', closeSellModal);

    // close modal if click outside (simple)
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeProductModal();
    });
    sellModal.addEventListener('click', (e) => {
        if (e.target === sellModal) closeSellModal();
    });

    // insight toggle
    insightToggleBtn.addEventListener('click', () => {
        insightPanel.classList.toggle('hidden');
        updateInsights();  // fresh data when opened
    });
    closeInsightBtn.addEventListener('click', () => {
        insightPanel.classList.add('hidden');
    });

    // open add modal via FAB
    openAddModalBtn.addEventListener('click', openAddModal);

    // startup
    loadFromStorage();
    renderProducts();
    updateInsights();
    // start with insight hidden (optional)
    insightPanel.classList.add('hidden');

    // ensure max attribute updates when selling modal opens (dynamic max)
    // but we already set in openSellModal, also on input change?
    // Not needed for demo, but handle if user manually types > stock
    sellQuantity.addEventListener('input', function() {
        const prod = products.find(p => p.id === currentSellId);
        if (prod && parseInt(this.value) > prod.stock) {
            this.value = prod.stock;
        }
    });
})();
