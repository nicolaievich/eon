import { supabase } from './lib/supabase';

// Resumen de horas de EÓN.
// La fuente de datos es la misma tabla "registros" que usa Ver registros.
// Los tres totales se obtienen sumando tiempo_minutos, sin depender de relaciones.

function fechaLocalISO(fecha = new Date()): string {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function formatearTiempo(minutos: number): string {
  const total = Math.max(0, Math.floor(Number(minutos) || 0));
  const horas = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function aplicarDiseñoResumen() {
  if (document.getElementById('eon-resumen-fix-style')) return;

  const style = document.createElement('style');
  style.id = 'eon-resumen-fix-style';
  style.textContent = `
    #resumenHoras > div:first-child {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 0.75rem !important;
    }
    #resumenHoras > div:first-child > article:first-child {
      grid-column: 1 / -1 !important;
    }
    @media (max-width: 600px) {
      #resumenHoras > div:first-child { grid-template-columns: 1fr !important; }
      #resumenHoras > div:first-child > article { grid-column: 1 / -1 !important; }
    }
  `;
  document.head.appendChild(style);
}

let cargando = false;
let ultimaVista: HTMLElement | null = null;

async function actualizarResumen(resumen: HTMLElement) {
  if (cargando) return;
  cargando = true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return;

    const hoy = new Date();
    const hoyISO = fechaLocalISO(hoy);
    const mesInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const diaSemana = hoy.getDay();
    const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const semanaInicio = new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      hoy.getDate() - diasDesdeLunes
    );

    // Una sola consulta. Después simplemente sumamos los minutos según cada período.
    const { data, error } = await supabase
      .from('registros')
      .select('fecha, tiempo_minutos, categoria_id')
      .eq('user_id', userId)
      .lte('fecha', hoyISO)
      .gte('fecha', fechaLocalISO(mesInicio));

    if (error) {
      console.error('EÓN: error al obtener registros para el resumen:', error);
      return;
    }

    const datos: any[] = data ?? [];
    const semanaISO = fechaLocalISO(semanaInicio);
    const mesISO = fechaLocalISO(mesInicio);

    const sumar = (lista: any[]) => lista.reduce(
      (total, registro) => total + Number(registro.tiempo_minutos || 0),
      0
    );

    const totalHoy = sumar(datos.filter(r => r.fecha === hoyISO));
    const totalSemana = sumar(datos.filter(r => r.fecha >= semanaISO));
    const totalMes = sumar(datos.filter(r => r.fecha >= mesISO));

    const horasDia = resumen.querySelector('#horasDia');
    const horasSemana = resumen.querySelector('#horasSemana');
    const horasMes = resumen.querySelector('#horasMes');

    if (horasDia) horasDia.textContent = formatearTiempo(totalHoy);
    if (horasSemana) horasSemana.textContent = formatearTiempo(totalSemana);
    if (horasMes) horasMes.textContent = formatearTiempo(totalMes);
  } finally {
    cargando = false;
  }
}

function revisarVista() {
  const resumen = document.getElementById('resumenHoras');
  if (!resumen) {
    ultimaVista = null;
    return;
  }

  aplicarDiseñoResumen();

  const elemento = resumen as HTMLElement;
  if (ultimaVista !== elemento) {
    ultimaVista = elemento;
    void actualizarResumen(elemento);
  }
}

// La vista es dinámica: se crea al entrar en "Ver registros".
const observer = new MutationObserver(revisarVista);
observer.observe(document.body, { childList: true, subtree: true });

revisarVista();
