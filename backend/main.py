import oracledb
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import os

app = FastAPI(title="DBMS Project Backend - Port Logistics")

DB_USER = "system"
DB_PASSWORD = "system32"
DB_DSN = "localhost:1521/XE"

def get_db_connection():
    try:
        connection = oracledb.connect(user=DB_USER, password=DB_PASSWORD, dsn=DB_DSN)
        return connection
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

class CargoBooking(BaseModel):
    voyage_id: int
    owner_id: str
    cargo_type: str
    weight: float
    origin: str
    dest: str

@app.post("/api/book-cargo")
def book_cargo(booking: CargoBooking):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor()

        cursor.callproc("book_cargo", [
            booking.voyage_id, 
            booking.owner_id, 
            booking.cargo_type, 
            booking.weight, 
            booking.origin, 
            booking.dest
        ])

        conn.commit()
        return {"status": "success", "message": "Cargo successfully booked."}
    except oracledb.DatabaseError as e:
        error, = e.args
        raise HTTPException(status_code=400, detail=error.message)
    finally:
        if conn:
            conn.close()

@app.get("/api/cargo-history/{owner_id}")
def get_cargo_history(owner_id: str):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor()
        
        out_cursor = conn.cursor()

        sql = """
            select cm.manifest_id, r.route_name, cm.cargo_type, cm.weight_tonnes, cm.freight_charge, v.status 
            from cargo_manifest cm 
            join voyage v on trim(cm.voyage_id) = trim(v.voyage_id) 
            join route r on trim(v.route_id) = trim(r.route_id) 
            where trim(cm.owner_id) = :owner_id 
            order by v.departure_date
        """
        cursor.execute(sql, owner_id=owner_id)
        rows = cursor.fetchall()
        columns = [col[0].lower() for col in cursor.description]
        
        result = [dict(zip(columns, row)) for row in rows]
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/api/vessel-report/{vessel_id}")
def get_vessel_report(vessel_id: str):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor()
        sql = """
            select v.voyage_id, r.route_name, v.departure_date, v.arrival_date, v.status, 
                nvl((select sum(cm.weight_tonnes) from cargo_manifest cm where trim(cm.voyage_id) = trim(v.voyage_id)), 0) as total_cargo 
            from voyage v 
            join route r on trim(v.route_id) = trim(r.route_id) 
            where trim(v.vessel_id) = :vessel_id 
            order by v.departure_date
        """
        cursor.execute(sql, vessel_id=vessel_id)
        rows = cursor.fetchall()
        columns = [col[0].lower() for col in cursor.description]
        
        result = [dict(zip(columns, row)) for row in rows]
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/api/next-voyage")
def get_next_voyage(origin: str, dest: str):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor()
        sql = """
            select v.voyage_id, vs.vessel_name, r.route_name, v.departure_date, v.arrival_date 
            from voyage v 
            join route r on trim(v.route_id) = trim(r.route_id) 
            join vessel vs on trim(v.vessel_id) = trim(vs.vessel_id) 
            where trim(r.origin_port_id) = :origin and trim(r.destination_port_id) = :dest 
            and lower(trim(v.status)) = 'scheduled' and v.departure_date > sysdate 
            order by v.departure_date asc fetch first 1 row only
        """
        cursor.execute(sql, origin=origin, dest=dest)
        row = cursor.fetchone()
        if not row:
            return {"status": "success", "data": None, "message": "No upcoming voyages found between these ports."}
            
        columns = [col[0].lower() for col in cursor.description]
        return {"status": "success", "data": dict(zip(columns, row))}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/api/analytics/route-bookings/{year}")
def get_route_bookings(year: int):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    try:
        cursor = conn.cursor()
        sql = """
            select r.route_name, to_char(v.departure_date,'MON') as month_name, 
                   extract(month from v.departure_date) as month_num, count(*) as bookings, 
                   sum(cm.weight_tonnes) as total_weight, sum(cm.freight_charge) as total_revenue
            from cargo_manifest cm
            join voyage v on trim(cm.voyage_id) = trim(v.voyage_id)
            join route r on trim(v.route_id) = trim(r.route_id)
            where extract(year from v.departure_date) = :year
            group by r.route_name, to_char(v.departure_date,'MON'), extract(month from v.departure_date)
            order by month_num
        """
        cursor.execute(sql, year=year)
        rows = cursor.fetchall()
        columns = [col[0].lower() for col in cursor.description]
        return {"status": "success", "data": [dict(zip(columns, r)) for r in rows]}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn: conn.close()

@app.get("/api/analytics/most-active/{year}")
def get_most_active_route(year: int):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    try:
        cursor = conn.cursor()
        result = cursor.callfunc("most_active_route", oracledb.STRING, [year])
        if not result:
            return {"status": "success", "route_id": None, "message": f"No data found for year {year}"}
        return {"status": "success", "route_id": result}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn: conn.close()

@app.get("/api/analytics/revenue/{route_id}/{start}/{end}")
def get_revenue(route_id: str, start: str, end: str):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    try:
        from datetime import datetime
        s_date = datetime.strptime(start, "%Y-%m-%d")
        e_date = datetime.strptime(end, "%Y-%m-%d")
        cursor = conn.cursor()
        result = cursor.callfunc("calculate_route_revenue", oracledb.NUMBER, [route_id, s_date, e_date])
        return {"status": "success", "revenue": float(result) if result is not None else 0.0}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn: conn.close()

@app.get("/api/analytics/cargo/{route_id}/{date}")
def get_total_cargo_api(route_id: str, date: str):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    try:
        from datetime import datetime
        d = datetime.strptime(date, "%Y-%m-%d")
        cursor = conn.cursor()
        result = cursor.callfunc("get_total_cargo", oracledb.NUMBER, [route_id, d])
        return {"status": "success", "total_cargo": float(result) if result is not None else 0.0}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn: conn.close()

@app.get("/api/vessel/maintenance-check/{vessel_id}")
def check_maintenance(vessel_id: str):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    try:
        cursor = conn.cursor()
        result = cursor.callfunc("months_since_last_maintenance", oracledb.NUMBER, [vessel_id])
        return {"status": "success", "months": float(result) if result is not None else None}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn: conn.close()

class VoyageData(BaseModel):
    voyage_id: int
    vessel_id: str
    route_id: str
    berth_id: str
    captain_id: str
    co_captain_id: str
    departure_date: str
    arrival_date: str
    status: str

@app.post("/api/voyage/schedule")
def schedule_voyage(v: VoyageData):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Connection failed")
    try:
        from datetime import datetime
        cursor = conn.cursor()
        sql = """
            INSERT INTO voyage (voyage_id, vessel_id, route_id, berth_id, 
                captain_id, co_captain_id, departure_date, arrival_date, status)
            VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)
        """
        dep = datetime.strptime(v.departure_date, "%Y-%m-%dT%H:%M")
        arr = datetime.strptime(v.arrival_date, "%Y-%m-%dT%H:%M")
        cursor.execute(sql, [v.voyage_id, v.vessel_id, v.route_id, v.berth_id, 
                             v.captain_id, v.co_captain_id, dep, arr, v.status])
        conn.commit()
        return {"status": "success", "message": "Voyage scheduled successfully!"}
    except oracledb.DatabaseError as e:
        error, = e.args
        raise HTTPException(status_code=400, detail=error.message)
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn: conn.close()

@app.delete("/api/voyage/{voyage_id}")
def delete_voyage(voyage_id: int):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Connection failed")
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) FROM voyage WHERE voyage_id = :1", [voyage_id])
        if cursor.fetchone()[0] == 0:
            raise HTTPException(status_code=404, detail=f"Voyage {voyage_id} not found.")
        cursor.execute("DELETE FROM cargo_manifest WHERE voyage_id = :1", [voyage_id])
        cursor.execute("DELETE FROM voyage WHERE voyage_id = :1", [voyage_id])
        conn.commit()
        return {"status": "success", "message": f"Voyage {voyage_id} and its cargo manifests deleted and archived!"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn: conn.close()

@app.delete("/api/cargo/{manifest_id}")
def delete_cargo(manifest_id: int):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cargo_manifest WHERE manifest_id = :1", [manifest_id])
        if cursor.rowcount == 0: raise Exception("Manifest not found.")
        conn.commit()
        return {"status": "success", "message": "Cargo manifest deleted and archived!"}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn: conn.close()

class IncidentData(BaseModel):
    voyage_id: int
    description: str

@app.post("/api/incident/log")
def log_incident(inc: IncidentData):
    conn = get_db_connection()
    if not conn: raise HTTPException(status_code=500, detail="DB Error")
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO incident (voyage_id, description) VALUES (:1, :2)", 
                       [inc.voyage_id, inc.description])
        conn.commit()
        return {"status": "success", "message": "Incident logged! Subsequent voyages automatically cancelled."}
    except Exception as e: raise HTTPException(status_code=400, detail=str(e))
    finally:
        if conn: conn.close()

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
