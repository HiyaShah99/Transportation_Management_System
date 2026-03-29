document.addEventListener('DOMContentLoaded', () => {

    const navLinks = document.querySelectorAll('.nav-links li');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {

            document.querySelector('.nav-links li.active').classList.remove('active');
            link.classList.add('active');

            pageTitle.textContent = link.textContent.trim();

            const targetView = link.getAttribute('data-view');
            viewSections.forEach(section => {
                if(section.id === targetView) {
                    section.classList.add('active');
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast`;
        if (type === 'error') toast.style.borderLeftColor = 'var(--error-color)';
        if (type === 'success') toast.style.borderLeftColor = 'var(--success-color)';
        
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 5000);
    }

    const API_BASE = 'http://localhost:8000/api';

    const nextVoyageForm = document.getElementById('next-voyage-form');
    nextVoyageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const origin = document.getElementById('nv_origin').value;
        const dest = document.getElementById('nv_dest').value;
        const resultBox = document.getElementById('nv-result');
        const btn = e.target.querySelector('button');
        
        btn.textContent = 'Searching...';
        try {
            const res = await fetch(`${API_BASE}/next-voyage?origin=${origin}&dest=${dest}`);
            const json = await res.json();
            
            resultBox.classList.remove('hidden');
            if (json.data) {
                resultBox.innerHTML = `
                    <div style="margin-bottom: 8px;"><strong>Voyage Found!</strong></div>
                    <div>Voyage ID: ${json.data.voyage_id}</div>
                    <div>Vessel: ${json.data.vessel_name}</div>
                    <div>Departure: ${new Date(json.data.departure_date).toLocaleString()}</div>
                `;
            } else {
                resultBox.innerHTML = `<em>${json.message || 'No upcoming voyages found.'}</em>`;
            }
        } catch (error) {
            showToast('Error communicating with backend', 'error');
            console.error(error);
        } finally {
            btn.textContent = 'Find Voyage';
        }
    });

    const bookCargoForm = document.getElementById('book-cargo-form');
    bookCargoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('booking-alert');
        const btn = e.target.querySelector('button');
        
        const payload = {
            voyage_id: parseInt(document.getElementById('bc_voyage_id').value),
            owner_id: document.getElementById('bc_owner_id').value,
            cargo_type: document.getElementById('bc_cargo_type').value,
            weight: parseFloat(document.getElementById('bc_weight').value),
            origin: document.getElementById('bc_origin').value,
            dest: document.getElementById('bc_dest').value
        };

        btn.textContent = 'Processing...';
        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/book-cargo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            alertBox.classList.remove('hidden', 'alert-success', 'alert-error');
            if(res.ok) {
                alertBox.classList.add('alert-success');
                alertBox.textContent = json.message || "Cargo successfully booked.";
                bookCargoForm.reset();
                showToast("Booking Success!", "success");
            } else {
                alertBox.classList.add('alert-error');
                alertBox.textContent = json.detail || "Error booking cargo.";
                showToast("Booking Failed", "error");
            }
        } catch (error) {
            alertBox.classList.remove('hidden');
            alertBox.classList.add('alert-error');
            alertBox.textContent = "Network error. Make sure the backend is running.";
        } finally {
            btn.textContent = 'Book Cargo';
            btn.disabled = false;
        }
    });

    const historyForm = document.getElementById('history-form');
    historyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ownerId = document.getElementById('ch_owner_id').value;
        const btn = e.target.querySelector('button');
        const wrapper = document.getElementById('history-table-wrapper');
        const tbody = document.querySelector('#history-table tbody');
        
        btn.textContent = 'Loading...';
        try {
            const res = await fetch(`${API_BASE}/cargo-history/${ownerId}`);
            if(!res.ok) throw new Error("Backend error");
            const json = await res.json();
            
            tbody.innerHTML = '';
            wrapper.classList.remove('hidden');
            
            if (json.data && json.data.length > 0) {
                json.data.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${row.manifest_id || '-'}</td>
                        <td>${row.route_name || '-'}</td>
                        <td>${row.origin || '-'}</td>
                        <td>${row.destination || '-'}</td>
                        <td>${row.cargo_type || '-'}</td>
                        <td>${row.weight_tonnes || '0'}</td>
                        <td>$${row.freight_charge || '0'}</td>
                        <td><span style="color:var(--accent-color)">${row.status || 'Active'}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center">No records found.</td></tr>`;
            }
        } catch (error) {
            showToast('Failed to fetch history', 'error');
        } finally {
            btn.textContent = 'View History';
        }
    });

    const vesselForm = document.getElementById('vessel-form');
    vesselForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vesselId = document.getElementById('vr_vessel_id').value;
        const btn = e.target.querySelector('button');
        const wrapper = document.getElementById('vessel-table-wrapper');
        const tbody = document.querySelector('#vessel-table tbody');
        
        btn.textContent = 'Generating...';
        try {
            const res = await fetch(`${API_BASE}/vessel-report/${vesselId}`);
            if(!res.ok) throw new Error("Backend error");
            const json = await res.json();
            
            tbody.innerHTML = '';
            wrapper.classList.remove('hidden');
            
            if (json.data && json.data.length > 0) {
                json.data.forEach(row => {
                    const tr = document.createElement('tr');
                    const dep = row.departure_date ? new Date(row.departure_date).toLocaleDateString() : '-';
                    const arr = row.arrival_date ? new Date(row.arrival_date).toLocaleDateString() : '-';
                    
                    tr.innerHTML = `
                        <td>${row.voyage_id || '-'}</td>
                        <td>${row.route_name || '-'}</td>
                        <td>${dep}</td>
                        <td>${arr}</td>
                        <td>${row.total_cargo || '0'}</td>
                        <td><span style="color:var(--success-color)">${row.status || '-'}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">No records found.</td></tr>`;
            }
        } catch (error) {
            showToast('Failed to generate report', 'error');
        } finally {
            btn.textContent = 'Generate Report';
        }
    });

    document.getElementById('route-bookings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const year = document.getElementById('ab_year').value;
        const btn = e.target.querySelector('button');
        btn.textContent = 'Wait...';
        
        try {
            const res = await fetch(`/api/analytics/route-bookings/${year}`);
            const json = await res.json();
            const wrapper = document.getElementById('route-bookings-table-wrapper');
            const tbody = document.querySelector('#route-bookings-table tbody');
            tbody.innerHTML = '';
            wrapper.classList.remove('hidden');
            
            if (json.data && json.data.length > 0) {
                json.data.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${r.route_name}</td>
                        <td>${r.month_name}</td>
                        <td>${r.bookings}</td>
                        <td>${r.total_weight || 0}</td>
                        <td>$${(r.total_revenue || 0).toLocaleString()}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">No bookings found for year ${year}.</td></tr>`;
            }
        } catch(e) { showToast('Error fetching route bookings', 'error'); } 
        finally { btn.textContent = 'Analyze'; }
    });

    document.getElementById('most-active-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const year = document.getElementById('ma_year').value;
        const resBox = document.getElementById('ma-result');
        const btn = e.target.querySelector('button');
        btn.textContent = 'Wait...';
        
        try {
            const res = await fetch(`/api/analytics/most-active/${year}`);
            const json = await res.json();
            resBox.textContent = json.status === 'success' ? `Most Active Route in ${year}: ${json.route_id || 'None'}` : json.detail;
            resBox.classList.remove('hidden');
        } catch(e) { showToast('Error', 'error'); } 
        finally { btn.textContent = 'Find'; }
    });

    document.getElementById('route-revenue-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const routeId = document.getElementById('rr_route').value;
        const start = document.getElementById('rr_start').value;
        const end = document.getElementById('rr_end').value;
        const resBox = document.getElementById('rr-result');
        const btn = e.target.querySelector('button');
        btn.textContent = 'Wait...';
        
        try {
            const res = await fetch(`/api/analytics/revenue/${routeId}/${start}/${end}`);
            const json = await res.json();
            if(json.status === 'success') {
                resBox.textContent = `Total Revenue for ${routeId}: $${(json.revenue || 0).toLocaleString()}`;
            } else resBox.textContent = json.detail;
            resBox.classList.remove('hidden');
        } catch(e) { showToast('Error', 'error'); } 
        finally { btn.textContent = 'Calculate'; }
    });

    document.getElementById('maintenance-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vesselId = document.getElementById('mt_vessel_id').value;
        const resBox = document.getElementById('mt-result');
        
        try {
            const res = await fetch(`/api/vessel/maintenance-check/${vesselId}`);
            const json = await res.json();
            if(json.status === 'success') {
                resBox.textContent = json.months === null ? `No maintenance record for ${vesselId}` : `Months since last maintenance: ${json.months.toFixed(1)}`;
            } else resBox.textContent = json.detail;
            resBox.classList.remove('hidden');
        } catch(e) { showToast('Error', 'error'); }
    });

    document.getElementById('schedule-voyage-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.textContent = 'Wait...';
        
        const payload = {
            voyage_id: parseInt(document.getElementById('sv_voyage_id').value),
            vessel_id: document.getElementById('sv_vessel_id').value,
            route_id: document.getElementById('sv_route_id').value,
            berth_id: document.getElementById('sv_berth_id').value,
            captain_id: document.getElementById('sv_captain').value,
            co_captain_id: document.getElementById('sv_cocaptain').value,
            departure_date: document.getElementById('sv_dep').value,
            arrival_date: document.getElementById('sv_arr').value,
            status: document.getElementById('sv_status').value
        };
        
        try {
            const res = await fetch('/api/voyage/schedule', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if(res.ok) showToast(json.message, 'success');
            else showToast(json.detail || 'Creation failed', 'error');
        } catch(e) { showToast('Request failed', 'error'); }
        finally { btn.textContent = 'Create Voyage'; }
    });

    document.getElementById('log-incident-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            voyage_id: parseInt(document.getElementById('li_voyage_id').value),
            description: document.getElementById('li_desc').value
        };
        try {
            const res = await fetch('/api/incident/log', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if(res.ok) showToast(json.message, 'success');
            else showToast(json.detail || 'Incident logging failed', 'error');
        } catch(e) { showToast('Request failed', 'error'); }
    });

    document.getElementById('delete-voyage-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vid = document.getElementById('dv_voyage_id').value;
        try {
            const res = await fetch(`/api/voyage/${vid}`, { method: 'DELETE' });
            const json = await res.json();
            if(res.ok) showToast(json.message, 'success');
            else showToast(json.detail || 'Delete failed', 'error');
        } catch(e) { showToast('Request failed', 'error'); }
    });

    document.getElementById('delete-cargo-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mid = document.getElementById('dc_manifest_id').value;
        try {
            const res = await fetch(`/api/cargo/${mid}`, { method: 'DELETE' });
            const json = await res.json();
            if(res.ok) showToast(json.message, 'success');
            else showToast(json.detail || 'Delete failed', 'error');
        } catch(e) { showToast('Request failed', 'error'); }
    });
});
