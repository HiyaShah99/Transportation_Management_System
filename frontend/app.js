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
                if (section.id === targetView) {
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
        toast.className = 'toast';
        if (type === 'error') toast.style.borderLeftColor = 'var(--error-color)';
        if (type === 'success') toast.style.borderLeftColor = 'var(--success-color)';
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            if (container.contains(toast)) container.removeChild(toast);
        }, 5000);
    }

    const API_BASE = '/api';

    document.getElementById('next-voyage-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const origin = document.getElementById('nv_origin').value.trim();
        const dest = document.getElementById('nv_dest').value.trim();
        const resultBox = document.getElementById('nv-result');
        const btn = e.target.querySelector('button');
        btn.textContent = 'Searching...';
        try {
            const res = await fetch(`${API_BASE}/next-voyage?origin=${origin}&dest=${dest}`);
            const json = await res.json();
            resultBox.classList.remove('hidden');
            if (json.data) {
                resultBox.innerHTML = `<div style="margin-bottom:8px"><strong>Voyage Found!</strong></div><div>Voyage ID: ${json.data.voyage_id}</div><div>Vessel: ${json.data.vessel_name}</div><div>Route: ${json.data.route_name}</div><div>Departure: ${new Date(json.data.departure_date).toLocaleDateString()}</div><div>Arrival: ${new Date(json.data.arrival_date).toLocaleDateString()}</div>`;
            } else {
                resultBox.innerHTML = `<em>${json.message || 'No upcoming voyages found.'}</em>`;
            }
        } catch (err) {
            showToast('Error communicating with backend', 'error');
        } finally {
            btn.textContent = 'Find Voyage';
        }
    });

    document.getElementById('book-cargo-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertBox = document.getElementById('booking-alert');
        const btn = e.target.querySelector('button');
        const payload = {
            voyage_id: parseInt(document.getElementById('bc_voyage_id').value),
            owner_id: document.getElementById('bc_owner_id').value.trim(),
            cargo_type: document.getElementById('bc_cargo_type').value,
            weight: parseFloat(document.getElementById('bc_weight').value),
            origin: document.getElementById('bc_origin').value.trim(),
            dest: document.getElementById('bc_dest').value.trim()
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
            if (res.ok) {
                alertBox.classList.add('alert-success');
                alertBox.textContent = json.message || 'Cargo successfully booked.';
                e.target.reset();
                showToast('Booking Success!', 'success');
            } else {
                alertBox.classList.add('alert-error');
                alertBox.textContent = json.detail || 'Error booking cargo.';
                showToast('Booking Failed', 'error');
            }
        } catch (err) {
            alertBox.classList.remove('hidden');
            alertBox.classList.add('alert-error');
            alertBox.textContent = 'Network error. Make sure the backend is running.';
        } finally {
            btn.textContent = 'Book Cargo';
            btn.disabled = false;
        }
    });

    document.getElementById('history-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const ownerId = document.getElementById('ch_owner_id').value.trim();
        const btn = e.target.querySelector('button');
        const wrapper = document.getElementById('history-table-wrapper');
        const tbody = document.querySelector('#history-table tbody');
        btn.textContent = 'Loading...';
        try {
            const res = await fetch(`${API_BASE}/cargo-history/${ownerId}`);
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            tbody.innerHTML = '';
            wrapper.classList.remove('hidden');
            if (json.data && json.data.length > 0) {
                json.data.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${row.manifest_id || '-'}</td><td>${row.route_name || '-'}</td><td>${row.cargo_type || '-'}</td><td>${row.weight_tonnes || '0'}</td><td>$${row.freight_charge || '0'}</td><td>${row.status || '-'}</td>`;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">No records found for owner ${ownerId}.</td></tr>`;
            }
        } catch (err) {
            showToast('Failed to fetch history: ' + err.message, 'error');
        } finally {
            btn.textContent = 'View History';
        }
    });

    document.getElementById('vessel-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const vesselId = document.getElementById('vr_vessel_id').value.trim();
        const btn = e.target.querySelector('button');
        const wrapper = document.getElementById('vessel-table-wrapper');
        const tbody = document.querySelector('#vessel-table tbody');
        btn.textContent = 'Generating...';
        try {
            const res = await fetch(`${API_BASE}/vessel-report/${vesselId}`);
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            tbody.innerHTML = '';
            wrapper.classList.remove('hidden');
            if (json.data && json.data.length > 0) {
                json.data.forEach(row => {
                    const tr = document.createElement('tr');
                    const dep = row.departure_date ? new Date(row.departure_date).toLocaleDateString() : '-';
                    const arr = row.arrival_date ? new Date(row.arrival_date).toLocaleDateString() : '-';
                    tr.innerHTML = `<td>${row.voyage_id || '-'}</td><td>${row.route_name || '-'}</td><td>${dep}</td><td>${arr}</td><td>${row.total_cargo || '0'}</td><td>${row.status || '-'}</td>`;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">No voyages found for vessel ${vesselId}.</td></tr>`;
            }
        } catch (err) {
            showToast('Failed to generate report: ' + err.message, 'error');
        } finally {
            btn.textContent = 'Generate Report';
        }
    });

    document.getElementById('route-bookings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const year = document.getElementById('ab_year').value;
        const btn = e.target.querySelector('button');
        const wrapper = document.getElementById('route-bookings-table-wrapper');
        const tbody = document.querySelector('#route-bookings-table tbody');
        btn.textContent = 'Loading...';
        try {
            const res = await fetch(`${API_BASE}/analytics/route-bookings/${year}`);
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            tbody.innerHTML = '';
            wrapper.classList.remove('hidden');
            if (json.data && json.data.length > 0) {
                json.data.forEach(r => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td>${r.route_name}</td><td>${r.month_name}</td><td>${r.bookings}</td><td>${r.total_weight || 0}</td><td>$${Number(r.total_revenue || 0).toLocaleString()}</td>`;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center">No bookings found for year ${year}.</td></tr>`;
            }
        } catch (err) {
            showToast('Error fetching route bookings: ' + err.message, 'error');
        } finally {
            btn.textContent = 'Analyze';
        }
    });

    document.getElementById('most-active-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const year = document.getElementById('ma_year').value;
        const resBox = document.getElementById('ma-result');
        const btn = e.target.querySelector('button');
        btn.textContent = 'Loading...';
        try {
            const res = await fetch(`${API_BASE}/analytics/most-active/${year}`);
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            resBox.classList.remove('hidden');
            resBox.textContent = json.route_id ? `Most Active Route in ${year}: ${json.route_id}` : (json.message || `No route data found for ${year}.`);
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            btn.textContent = 'Find';
        }
    });

    document.getElementById('route-revenue-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const routeId = document.getElementById('rr_route').value.trim();
        const start = document.getElementById('rr_start').value;
        const end = document.getElementById('rr_end').value;
        const resBox = document.getElementById('rr-result');
        const btn = e.target.querySelector('button');
        btn.textContent = 'Loading...';
        try {
            const res = await fetch(`${API_BASE}/analytics/revenue/${routeId}/${start}/${end}`);
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            resBox.classList.remove('hidden');
            resBox.textContent = `Total Revenue for ${routeId} (${start} to ${end}): $${Number(json.revenue || 0).toLocaleString()}`;
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            btn.textContent = 'Calculate';
        }
    });

    document.getElementById('maintenance-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vesselId = document.getElementById('mt_vessel_id').value.trim();
        const resBox = document.getElementById('mt-result');
        const btn = e.target.querySelector('button');
        btn.textContent = 'Checking...';
        try {
            const res = await fetch(`${API_BASE}/vessel/maintenance-check/${vesselId}`);
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            resBox.classList.remove('hidden');
            resBox.textContent = json.months === null ? `No maintenance record found for vessel ${vesselId}.` : `Vessel ${vesselId}: ${json.months.toFixed(1)} months since last maintenance.`;
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        } finally {
            btn.textContent = 'Check Maintenance';
        }
    });

    document.getElementById('schedule-voyage-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.textContent = 'Saving...';
        const payload = {
            voyage_id: parseInt(document.getElementById('sv_voyage_id').value),
            vessel_id: document.getElementById('sv_vessel_id').value.trim(),
            route_id: document.getElementById('sv_route_id').value.trim(),
            berth_id: document.getElementById('sv_berth_id').value.trim(),
            captain_id: document.getElementById('sv_captain').value.trim(),
            co_captain_id: document.getElementById('sv_cocaptain').value.trim(),
            departure_date: document.getElementById('sv_dep').value,
            arrival_date: document.getElementById('sv_arr').value,
            status: document.getElementById('sv_status').value
        };
        try {
            const res = await fetch(`${API_BASE}/voyage/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (res.ok) { showToast(json.message || 'Voyage scheduled!', 'success'); e.target.reset(); }
            else showToast(json.detail || 'Failed to schedule voyage.', 'error');
        } catch (err) {
            showToast('Request failed: ' + err.message, 'error');
        } finally {
            btn.textContent = 'Create Voyage';
        }
    });

    document.getElementById('log-incident-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.textContent = 'Logging...';
        const payload = {
            voyage_id: parseInt(document.getElementById('li_voyage_id').value),
            description: document.getElementById('li_desc').value.trim()
        };
        try {
            const res = await fetch(`${API_BASE}/incident/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (res.ok) { showToast(json.message || 'Incident logged!', 'success'); e.target.reset(); }
            else showToast(json.detail || 'Failed to log incident.', 'error');
        } catch (err) {
            showToast('Request failed: ' + err.message, 'error');
        } finally {
            btn.textContent = 'Log Incident';
        }
    });

    document.getElementById('delete-voyage-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vid = document.getElementById('dv_voyage_id').value;
        const btn = e.target.querySelector('button');
        btn.textContent = 'Deleting...';
        try {
            const res = await fetch(`${API_BASE}/voyage/${vid}`, { method: 'DELETE' });
            const json = await res.json();
            if (res.ok) { showToast(json.message || 'Voyage deleted and archived!', 'success'); e.target.reset(); }
            else showToast(json.detail || 'Delete failed.', 'error');
        } catch (err) {
            showToast('Request failed: ' + err.message, 'error');
        } finally {
            btn.textContent = 'Delete';
        }
    });

    document.getElementById('delete-cargo-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mid = document.getElementById('dc_manifest_id').value;
        const btn = e.target.querySelector('button');
        btn.textContent = 'Deleting...';
        try {
            const res = await fetch(`${API_BASE}/cargo/${mid}`, { method: 'DELETE' });
            const json = await res.json();
            if (res.ok) { showToast(json.message || 'Cargo deleted and archived!', 'success'); e.target.reset(); }
            else showToast(json.detail || 'Delete failed.', 'error');
        } catch (err) {
            showToast('Request failed: ' + err.message, 'error');
        } finally {
            btn.textContent = 'Delete';
        }
    });

});
