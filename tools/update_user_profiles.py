import pyodbc

conn_str = (
    r"DRIVER={ODBC Driver 17 for SQL Server};"
    r"SERVER=localhost\SQLEXPRESS;"
    r"DATABASE=SafaiTrackDb;"
    r"Trusted_Connection=yes;"
)

# 21 Drivers (in exact order from driver@safaitrack.local through driver020@safaitrack.local)
DRIVERS = [
    ("driver@safaitrack.local", "Karim Driver", "Male", "+8801711000101"),
    ("driver001@safaitrack.local", "Jasim Uddin", "Male", "+8801711000102"),
    ("driver002@safaitrack.local", "Nazrul Islam", "Male", "+8801711000103"),
    ("driver003@safaitrack.local", "Abul Kalam", "Male", "+8801711000104"),
    ("driver004@safaitrack.local", "Habibur Rahman", "Male", "+8801711000105"),
    ("driver005@safaitrack.local", "Shahjahan Mia", "Male", "+8801711000106"),
    ("driver006@safaitrack.local", "Delwar Hossain", "Male", "+8801711000107"),
    ("driver007@safaitrack.local", "Mizanur Rahman", "Male", "+8801711000108"),
    ("driver008@safaitrack.local", "Nurul Amin", "Male", "+8801711000109"),
    ("driver009@safaitrack.local", "Aminul Islam", "Male", "+8801711000110"),
    ("driver010@safaitrack.local", "Rafiqul Islam", "Male", "+8801711000111"),
    ("driver011@safaitrack.local", "Shamsul Haque", "Male", "+8801711000112"),
    ("driver012@safaitrack.local", "Kamal Uddin", "Male", "+8801711000113"),
    ("driver013@safaitrack.local", "Golam Mostofa", "Male", "+8801711000114"),
    ("driver014@safaitrack.local", "Anwar Hossain", "Male", "+8801711000115"),
    ("driver015@safaitrack.local", "Faruk Ahmed", "Male", "+8801711000116"),
    ("driver016@safaitrack.local", "Shafiqul Alam", "Male", "+8801711000117"),
    ("driver017@safaitrack.local", "Mokbul Hossain", "Male", "+8801711000118"),
    ("driver018@safaitrack.local", "Abdur Razzak", "Male", "+8801711000119"),
    ("driver019@safaitrack.local", "Liakot Ali", "Male", "+8801711000120"),
    ("driver020@safaitrack.local", "Selim Reza", "Male", "+8801711000121"),
]

# 45 Ward Officers (Distinct realistic Bangladeshi male and female names)
OFFICERS = [
    ("officer.adabor@safaitrack.local", "Farida Yasmin", "Female", "+8801812000201"),
    ("officer.badda@safaitrack.local", "Mahbub Alam", "Male", "+8801812000202"),
    ("officer.banani@safaitrack.local", "Shirin Akter", "Female", "+8801812000203"),
    ("officer.cantonment@safaitrack.local", "Ruhul Kabir", "Male", "+8801812000204"),
    ("officer.dakshin_khan@safaitrack.local", "Nasrin Begum", "Female", "+8801812000205"),
    ("officer.demra@safaitrack.local", "Zillur Rahman", "Male", "+8801812000206"),
    ("officer.dhanmondi@safaitrack.local", "Sabina Yeasmin", "Female", "+8801812000207"),
    ("officer.farmgate@safaitrack.local", "Enamul Haque", "Male", "+8801812000208"),
    ("officer.gandaria@safaitrack.local", "Rokeya Sultana", "Female", "+8801812000209"),
    ("officer.gulshan.backup@safaitrack.local", "Anisur Rahman", "Male", "+8801812000210"),
    ("officer.gulshan@safaitrack.local", "Tahmina Chowdhury", "Female", "+8801812000211"),
    ("officer.hatirjheel@safaitrack.local", "Monirul Islam", "Male", "+8801812000212"),
    ("officer.hazaribagh@safaitrack.local", "Kamrun Nahar", "Female", "+8801812000213"),
    ("officer.jatrabari@safaitrack.local", "Kazi Mostaq Ahmed", "Male", "+8801812000214"),
    ("officer.kadamtali@safaitrack.local", "Shahana Parvin", "Female", "+8801812000215"),
    ("officer.kafrul@safaitrack.local", "Golam Sarwar", "Male", "+8801812000216"),
    ("officer.kalabagan@safaitrack.local", "Rasheda Khanam", "Female", "+8801812000217"),
    ("officer.kamrangirchar@safaitrack.local", "Jahangir Hossain", "Male", "+8801812000218"),
    ("officer.khilgaon@safaitrack.local", "Laila Arjumand", "Female", "+8801812000219"),
    ("officer.khilkhet@safaitrack.local", "Moshiur Rahman", "Male", "+8801812000220"),
    ("officer.kotwali@safaitrack.local", "Rehana Akhter", "Female", "+8801812000221"),
    ("officer.lalbagh@safaitrack.local", "Fazlul Karim", "Male", "+8801812000222"),
    ("officer.lalmatia@safaitrack.local", "Sultana Razia", "Female", "+8801812000223"),
    ("officer.mirpur.backup@safaitrack.local", "Asaduzzaman Nur", "Male", "+8801812000224"),
    ("officer.mirpur@safaitrack.local", "Ferdousi Begum", "Female", "+8801812000225"),
    ("officer.mohammadpur@safaitrack.local", "Saiful Islam", "Male", "+8801812000226"),
    ("officer.mugda@safaitrack.local", "Khaleda Akter", "Female", "+8801812000227"),
    ("officer.pallabi@safaitrack.local", "Mustafizur Rahman", "Male", "+8801812000228"),
    ("officer.rampura@safaitrack.local", "Nusrat Parveen", "Female", "+8801812000229"),
    ("officer.rayer_bazar@safaitrack.local", "Ashraf Ali", "Male", "+8801812000230"),
    ("officer.sabujbagh@safaitrack.local", "Jesmin Ara", "Female", "+8801812000231"),
    ("officer.sher_e_bangla_nagar@safaitrack.local", "Shahidul Haque", "Male", "+8801812000232"),
    ("officer.shewrapara@safaitrack.local", "Bilkiss Banu", "Female", "+8801812000233"),
    ("officer.shyampur@safaitrack.local", "Sirajul Islam", "Male", "+8801812000234"),
    ("officer.sutrapur@safaitrack.local", "Salma Khatun", "Female", "+8801812000235"),
    ("officer.tejgaon@safaitrack.local", "Abdur Rahim Mia", "Male", "+8801812000236"),
    ("officer.turag@safaitrack.local", "Nazma Begum", "Female", "+8801812000237"),
    ("officer.uttar_khan@safaitrack.local", "Kabir Hossain", "Male", "+8801812000238"),
    ("officer.uttara_centre@safaitrack.local", "Afroza Parvin", "Female", "+8801812000239"),
    ("officer.uttara_east@safaitrack.local", "Zakir Hossain", "Male", "+8801812000240"),
    ("officer.uttara_west.backup@safaitrack.local", "Meherun Nesa", "Female", "+8801812000241"),
    ("officer.uttara_west@safaitrack.local", "Tanvir Mahmud", "Male", "+8801812000242"),
    ("officer.vatara@safaitrack.local", "Shamima Nasrin", "Female", "+8801812000243"),
    ("officer08.backup@safaitrack.local", "Sayedul Hoque", "Male", "+8801812000244"),
    ("officer08@safaitrack.local", "Tariq Officer", "Male", "+8801812000245"),
]

# Citizens (Distinct Bangladeshi names)
CITIZENS = [
    ("citizen@safaitrack.local", "Tanvir Hossain", "Male", "+8801991000101"),
    ("citizen01@safaitrack.local", "Nusrat Jahan", "Female", "+8801991000102"),
    ("citizen02@safaitrack.local", "Sadia Afrin", "Female", "+8801991000103"),
    ("easteak00987@gmail.com", "Easteak Ahmed", "Male", "+8801991000166"),
]

# Admin
ADMIN = [
    ("admin@safaitrack.local", "Khandakar Admin", "Male", "+8801991000001")
]

conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

all_updates = DRIVERS + OFFICERS + CITIZENS + ADMIN
count = 0

for email, full_name, gender, phone in all_updates:
    cursor.execute("""
        UPDATE AspNetUsers
        SET FullName = ?, Gender = ?, PhoneNumber = ?
        WHERE Email = ?
    """, (full_name, gender, phone, email))
    if cursor.rowcount > 0:
        count += 1
    else:
        print(f"User not found: {email}")

conn.commit()
print(f"Successfully updated {count} users in AspNetUsers table.")
conn.close()
