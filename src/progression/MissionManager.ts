// Missions system tracking player achievements and granting rewards

import type { Mission } from '../core/Constants';
import { gameState } from '../core/GameState';
import { eventBus } from '../core/EventBus';
import { audioManager } from '../audio/AudioManager';

export class MissionManager {
  private static instance: MissionManager;
  private missions: Mission[] = [
    {
      id: 'm_dist_1',
      title: 'Boğaziçi Fatihi I',
      description: 'Boğaz Köprüsü ve otoyolda 2.000 metre ilerle.',
      rewardCash: 5000,
      targetValue: 2000,
      currentValue: 0,
      type: 'distance',
      isCompleted: false,
      isClaimed: false,
    },
    {
      id: 'm_near_1',
      title: 'İstanbul Makasçısı I',
      description: 'Sarı taksi ve dolmuşlara 8 kez sıfır makas at.',
      rewardCash: 7500,
      targetValue: 8,
      currentValue: 0,
      type: 'near_misses',
      isCompleted: false,
      isClaimed: false,
    },
    {
      id: 'm_speed_1',
      title: 'EDS Radarı Delen I',
      description: 'E-5 otoyolunda 180 KM/S hıza ulaş.',
      rewardCash: 10000,
      targetValue: 180,
      currentValue: 0,
      type: 'speed',
      isCompleted: false,
      isClaimed: false,
    },
    {
      id: 'm_score_1',
      title: 'Mega Şehir Efsanesi',
      description: 'Tek yarışta 15.000 puan topla.',
      rewardCash: 12500,
      targetValue: 15000,
      currentValue: 0,
      type: 'score',
      isCompleted: false,
      isClaimed: false,
    },
    {
      id: 'm_dist_2',
      title: 'Boğaziçi Fatihi II',
      description: "Avrupa'dan Asya'ya 5.000 metre katet.",
      rewardCash: 20000,
      targetValue: 5000,
      currentValue: 0,
      type: 'distance',
      isCompleted: false,
      isClaimed: false,
    },
    {
      id: 'm_near_2',
      title: 'Makas Ustası',
      description: 'Trafikte toplam 20 kez sıfır makas at.',
      rewardCash: 25000,
      targetValue: 20,
      currentValue: 0,
      type: 'near_misses',
      isCompleted: false,
      isClaimed: false,
    },
    {
      id: 'm_speed_2',
      title: 'Hız Rekortmeni',
      description: 'Otoyolda 220 KM/S hıza ulaş.',
      rewardCash: 25000,
      targetValue: 220,
      currentValue: 0,
      type: 'speed',
      isCompleted: false,
      isClaimed: false,
    },
    {
      id: 'm_wrong_1',
      title: 'Ters Yön Canavarı',
      description: 'Çift yön modunda ters şeritte 350 metre ilerle.',
      rewardCash: 18000,
      targetValue: 350,
      currentValue: 0,
      type: 'wrong_way',
      isCompleted: false,
      isClaimed: false,
    },
    {
      id: 'm_nitro_1',
      title: 'Nitro Delisi',
      description: 'Toplam 15 saniye boyunca nitro ateşle.',
      rewardCash: 15000,
      targetValue: 15,
      currentValue: 0,
      type: 'nitro',
      isCompleted: false,
      isClaimed: false,
    },
    {
      id: 'm_dist_3',
      title: 'Kıtalararası Efsane',
      description: 'Tek yarışta 10.000 metre rekor mesafeye ulaş.',
      rewardCash: 50000,
      targetValue: 10000,
      currentValue: 0,
      type: 'distance',
      isCompleted: false,
      isClaimed: false,
    },
  ];

  public static getInstance(): MissionManager {
    if (!MissionManager.instance) {
      MissionManager.instance = new MissionManager();
    }
    return MissionManager.instance;
  }

  public getMissions(): Mission[] {
    return this.missions;
  }

  public updateDistance(totalMeters: number): void {
    this.missions.forEach((m) => {
      if (m.type === 'distance' && !m.isCompleted) {
        m.currentValue = totalMeters;
        if (m.currentValue >= m.targetValue) {
          m.isCompleted = true;
        }
      }
    });
  }

  public trackSpeed(speedKmh: number): void {
    this.missions.forEach((m) => {
      if (m.type === 'speed' && !m.isCompleted) {
        m.currentValue = Math.max(m.currentValue, Math.floor(speedKmh));
        if (m.currentValue >= m.targetValue) {
          m.isCompleted = true;
        }
      }
    });
  }

  public trackNearMiss(): void {
    this.missions.forEach((m) => {
      if (m.type === 'near_misses' && !m.isCompleted) {
        m.currentValue++;
        if (m.currentValue >= m.targetValue) {
          m.isCompleted = true;
        }
      }
    });
  }

  public trackScore(score: number): void {
    this.missions.forEach((m) => {
      if (m.type === 'score' && !m.isCompleted) {
        m.currentValue = Math.max(m.currentValue, Math.floor(score));
        if (m.currentValue >= m.targetValue) {
          m.isCompleted = true;
        }
      }
    });
  }

  public trackWrongWay(deltaMeters: number): void {
    this.missions.forEach((m) => {
      if (m.type === 'wrong_way' && !m.isCompleted) {
        m.currentValue += Math.round(deltaMeters);
        if (m.currentValue >= m.targetValue) {
          m.isCompleted = true;
        }
      }
    });
  }

  public trackNitro(deltaSeconds: number): void {
    this.missions.forEach((m) => {
      if (m.type === 'nitro' && !m.isCompleted) {
        m.currentValue += Math.round(deltaSeconds);
        if (m.currentValue >= m.targetValue) {
          m.isCompleted = true;
        }
      }
    });
  }

  public claimReward(missionId: string): boolean {
    const m = this.missions.find((mission) => mission.id === missionId);
    if (!m || !m.isCompleted || m.isClaimed) return false;

    m.isClaimed = true;
    gameState.addMoney(m.rewardCash);
    audioManager.playReward();
    eventBus.emit('missionCompleted', { missionId: m.id, rewardCash: m.rewardCash });
    return true;
  }
}

export const missionManager = MissionManager.getInstance();
